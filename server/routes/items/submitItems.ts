import { type ItemIdentifier } from '@roostorg/types';
import { v1 as uuidv1 } from 'uuid';


import {
  type Dependencies,
  type ItemSubmissionKafkaMessageValue,
} from '../../iocContainer/index.js';
import { safeGetEnvVar } from '../../iocContainer/utils.js';
import {
  getFieldValueForRole,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
  type ItemSubmissionWithTypeIdentifier,
} from '../../services/itemProcessingService/index.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  getMessageFromAggregateError,
  makeBadRequestError,
  type CoopError,
} from '../../utils/errors.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { safeGet, withRetries } from '../../utils/misc.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { type SubmitItemsInput } from './ItemRoutes.js';

/**
 * Returns a string used to logically partition related item submissions
 * together in the underlying data store.
 *
 * this is closely related to the idea of syntheticThreadId in the
 * ItemInvestigationService and this function should not be changed unless the
 * function in `server/services/ItemInvestigationService/utils.ts` is also
 * changing
 *
 * TODO: Move this function to a proper server Util with a SyntheticThreadId
 * Opaque type
 */
export function getSyntheticThreadId(
  itemIdentifier: ItemIdentifier,
  threadIdentifier?: ItemIdentifier,
) {
  const availableIdentifier = threadIdentifier ?? itemIdentifier;
  return jsonStringify([availableIdentifier.typeId, availableIdentifier.id]);
}

export default function submitItems({
  ContentApiLogger,
  RuleEngine,
  ModerationConfigService,
  Tracer,
  ItemInvestigationService,
  getItemTypeEventuallyConsistent,
  Meter,
  itemSubmissionQueueBulkWrite,
  HMAHashBankService,
}: // @ts-ignore
Dependencies): RequestHandlerWithBodies<SubmitItemsInput, undefined> {
  return async (req, res, next) => {
    // Generate an id for this request to correlate logs. It doesn't need to be
    // random for security (i.e., uuidv4), and making it time-based could
    // actually be convenient, so that's what we do. We'll eventually get much
    // more sophisticated about how we pass this around (continuation local
    // storage? injected logger instances?), but this is fine for now.
    const requestId = toCorrelationId({ type: 'post-items', id: uuidv1() });

    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(req)) {
      return next(
        makeBadRequestError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }
    
    const { orgId } = req;

    // TODO: error handling. Our controllers still need much better error
    // handling abstractions.
    const { body } = req;
    const { items } = body;

    Meter.itemSubmissionsCounter.add(items.length);

    const toItemSubmission = rawItemSubmissionToItemSubmission.bind(
      null,
      await ModerationConfigService.getItemTypes({ orgId }),
      orgId,
      getItemTypeEventuallyConsistent,
    );

    const itemSubmissionsOrErrors = await Promise.all(
      items.map(async (message) => {
        const itemSubmission = await toItemSubmission(message);

        if (
          Array.isArray(itemSubmission.itemSubmission?.data.images) &&
          itemSubmission.itemSubmission.data.images.length > 0 &&
          !itemSubmission.error
        ) {
          try {
            const images = itemSubmission.itemSubmission.data.images as (string | {url: string})[];
            
            // Get all hash banks for this org once
            const allBanks = await HMAHashBankService.listBanks(orgId);
            const allBankNames = allBanks.map(bank => bank.hma_name);
            
            const imageHashes = await Promise.all(
              images.map(async (image) => {
                const url = typeof image === 'string' ? image : image.url;
                if (typeof url === 'string' && url) {
                  try {
                    const hmaHashWithRetries = await withRetries(
                      {
                        maxRetries: 5,
                        initialTimeMsBetweenRetries: 5,
                        maxTimeMsBetweenRetries: 500,
                        jitter: true,
                      },
                      async () => {
                        return HMAHashBankService.hashContentFromUrl(url);
                      }
                    );
                    const hashes = await hmaHashWithRetries();
                    
                    // Check which banks match this image
                    const matchedBankNames: string[] = [];
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    if (hashes && Object.keys(hashes).length > 0 && allBankNames.length > 0) {
                      const matchResults = await Promise.all(
                        Object.entries(hashes).map(async ([signalType, hash]) =>
                          HMAHashBankService.checkImageMatchWithDetails(allBankNames, signalType, hash)
                        )
                      );
                      
                      // Collect all matched banks
                      const allMatchedHmaBanks = new Set<string>();
                      matchResults.forEach(result => {
                        result.matchedBanks.forEach(bank => allMatchedHmaBanks.add(bank));
                      });
                      
                      // Map HMA bank names to user-friendly names
                      allMatchedHmaBanks.forEach(hmaName => {
                        const bank = allBanks.find(b => b.hma_name === hmaName);
                        if (bank) {
                          matchedBankNames.push(bank.name);
                        }
                      });
                    }
                    
                    return {
                      url,
                      hashes,
                      matchedBanks: matchedBankNames.length > 0 ? matchedBankNames : undefined
                    };
                  } catch (e) {
                    return {
                      url,
                      hashes: {}
                    };
                  }
                }
                return null;
              })
            );
            // Attach the hashes array to the item submission data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (itemSubmission.itemSubmission.data as any).images = imageHashes;
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to get HMA hashes for images:', error);
          }
        }

        return itemSubmission;
      }),
    );

    const errors = filterNullOrUndefined(
      itemSubmissionsOrErrors.map((it, itemSubmissionIndex) =>
        it.error
          ? new AggregateError(
              // Link errors back to the problematic item from the original
              // request. This is JSON Pointer syntax.
              it.error.errors.map((it) =>
                (it as CoopError).cloneWith({
                  pointer: `/items/${itemSubmissionIndex}`,
                }),
              ),
            )
          : undefined,
      ),
    );

    if (errors.length > 0) {
      // Log errors and failures for every item submission even if they were
      // valid because we won't run any of them against rules
      await Promise.all(
        itemSubmissionsOrErrors.map(async (itemSubmissionOrError) => {
          // TODO: Also log an error in the cases where we couldn't find the
          // itemType which is when itemSubmission is undefined
          if (itemSubmissionOrError.itemSubmission === undefined) {
            return;
          }

          await ContentApiLogger.logContentApiRequest<true>(
            {
              requestId,
              orgId,
              itemSubmission: itemSubmissionOrError.itemSubmission,
              failureReason:
                itemSubmissionOrError.error !== undefined
                  ? `Item submission failed validation: ${getMessageFromAggregateError(
                      itemSubmissionOrError.error,
                    )}`
                  : 'Failed to process item submission because other items in the submission failed validation',
            },
            false,
          );
        }),
      );
      return next(new AggregateError(errors));
    }

    // Send 5% of traffic to the async processing queue, otherwise handle in
    // the traditional way (in this process, immediately after returning 202 to
    // the user)
    const trafficPercentage = Number(
      safeGetEnvVar('ITEM_QUEUE_TRAFFIC_PERCENTAGE'),
    );
    if (Math.random() < trafficPercentage) {
      // toItemSubmission should always set a `submissionTime` property with a
      // valid Date, but due to legacy data the type returned, ItemSubmission, an
      // optional `submissionTime` property. this variable is used to convince
      // typescript that the value we subsequently pass to itemSubmissionQueueBulkWrite has
      // a valid Date in the `submissionTime` property, which is specified in the
      // schema for the kafka topic that item submissions get written to.
      const backupSubmissiontime = new Date();
      const submissionsToProcess = itemSubmissionsOrErrors.map((it) => {
        // We checked for errors earlier so this should never happen
        if (it.error !== undefined) {
          throw new Error('Unexpected error in item submission');
        }

        const threadId =
          it.itemSubmission.itemType.kind === 'CONTENT'
            ? getFieldValueForRole(
                it.itemSubmission.itemType.schema,
                it.itemSubmission.itemType.schemaFieldRoles,
                'threadId',
                it.itemSubmission.data,
              )
            : undefined;

        const itemSubmission = itemSubmissionToItemSubmissionWithTypeIdentifier(
          it.itemSubmission,
        ) satisfies ItemSubmissionWithTypeIdentifier;

        return {
          metadata: {
            requestId,
            orgId,
            syntheticThreadId: getSyntheticThreadId(
              {
                id: it.itemSubmission.itemId,
                typeId: it.itemSubmission.itemType.id,
              },
              threadId,
            ),
          },
          itemSubmissionWithTypeIdentifier: {
            submissionId: itemSubmission.submissionId,
            itemTypeIdentifier: itemSubmission.itemTypeIdentifier,
            itemId: itemSubmission.itemId,

            dataJSON: jsonStringify(it.itemSubmission.data),
            submissionTime:
              // submissionTime should never be undefined on a (new)
              // ItemSubmission, but the annotated return type from
              // toItemSubmission specifies it is optional, as noted above
              it.itemSubmission.submissionTime ?? backupSubmissiontime,
          },
        } satisfies ItemSubmissionKafkaMessageValue;
      });

      Meter.itemsEnqueued.add(submissionsToProcess.length);
      await Tracer.addActiveSpan(
        {
          resource: 'SubmitItems',
          operation: 'itemSubmissionQueueBulkWrite',
        },
        async (span) => {
          const bulkWriteResponse = await itemSubmissionQueueBulkWrite(
            submissionsToProcess,
          );
          if (bulkWriteResponse.error) {
            span.recordException(
              bulkWriteResponse.results.find(
                (response) => response instanceof Error,
              ) ??
                new Error(
                  'Unknown error in bulk write to item submission queue',
                ),
            );
            res.status(500).end();
          }
        },
      );

      res.status(202).end();
    } else {
      // Return 202 immediately now that validation is complete, then keep executing other code
      res.status(202).end();

      // Convert the item submission to something that gets accepted by the Rule
      // Engine, will get replaced after RuleEngine takes an ItemSubmission rather
      // than a ContentSubmission
      const dataForRuleEngine = itemSubmissionsOrErrors.map((it) => {
        // We checked for errors earlier so this should never happen
        if (it.error !== undefined) {
          throw new Error('Unexpected error in item submission');
        }

        return it.itemSubmission satisfies ItemSubmission as ItemSubmission & {
          submissionTime: Date;
        };
      });

      const insertWithRetries = Tracer.traced(
        {
          resource: 'SubmitItems',
          operation: 'ItemInvestigationService.insertItem',
        },
        withRetries(
          {
            maxRetries: 1,
            initialTimeMsBetweenRetries: 50,
            maxTimeMsBetweenRetries: 200,
          },
          ItemInvestigationService.insertItem.bind(ItemInvestigationService),
        ),
      );
      // Write to scylla before running rules in case any of the actions
      // depend on scylla
      await Promise.all(
        dataForRuleEngine.map(async (data) => {
          try {
            await insertWithRetries({
              requestId,
              orgId,
              itemSubmission: data,
            });
          } catch (e: unknown) {
            //swallow error for now
          }
        }),
      );

      // Now that the item submissions are normalized, run rules
      await Promise.all(
        dataForRuleEngine.map(async (data) => {
          Meter.itemProcessingAttemptsCounter.add(1, {
            process: 'items-async-route-handler',
          });
          // Run rules
          try {
            await RuleEngine.runEnabledRules(data, requestId);

            await ContentApiLogger.logContentApiRequest(
              {
                requestId,
                orgId,
                itemSubmission: data,
                failureReason: undefined,
              },
              false,
            );
          } catch (e: unknown) {
            Tracer.logActiveSpanFailedIfAny(e);
            await ContentApiLogger.logContentApiRequest(
              {
                requestId,
                orgId,
                itemSubmission: data,
                failureReason: `Rules failed to run for content: ${String(
                  safeGet(e, ['message']),
                )}`,
              },
              false,
            );
            Meter.itemProcessingFailuresCounter.add(1, {
              process: 'items-async-route-handler',
            });
          }
        }),
      );


    }
  };
}
