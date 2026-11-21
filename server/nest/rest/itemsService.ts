import { Injectable } from '@nestjs/common';
import { type ItemIdentifier } from '@roostorg/coop-types';
import { v1 as uuidv1 } from 'uuid';

import {
  type Dependencies,
  type ItemSubmissionMessageValue,
} from '../../iocContainer/index.js';
import { safeGetEnvVar } from '../../iocContainer/utils.js';
import { addHashesToImageFields } from '../../routes/items/hashImageFields.js';
import { type SubmitItemsInput } from '../../routes/items/ItemRoutes.js';
import {
  getFieldValueForRole,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
  type ItemSubmissionWithTypeIdentifier,
} from '../../services/itemProcessingService/index.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import { toCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  getMessageFromAggregateError,
  type CoopError,
} from '../../utils/errors.js';
import { safeGet, withRetries } from '../../utils/misc.js';
import { InjectDep } from '../tokens.js';

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

@Injectable()
export class ItemsService {
  constructor(
    @InjectDep('ContentApiLogger')
    private readonly ContentApiLogger: Dependencies['ContentApiLogger'],
    @InjectDep('RuleEngine')
    private readonly RuleEngine: Dependencies['RuleEngine'],
    @InjectDep('ModerationConfigService')
    private readonly ModerationConfigService: Dependencies['ModerationConfigService'],
    @InjectDep('Tracer') private readonly Tracer: Dependencies['Tracer'],
    @InjectDep('ItemInvestigationService')
    private readonly ItemInvestigationService: Dependencies['ItemInvestigationService'],
    @InjectDep('getItemTypeEventuallyConsistent')
    private readonly getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'],
    @InjectDep('Meter') private readonly Meter: Dependencies['Meter'],
    @InjectDep('itemSubmissionQueueBulkWrite')
    private readonly itemSubmissionQueueBulkWrite: Dependencies['itemSubmissionQueueBulkWrite'],
    @InjectDep('HMAHashBankService')
    private readonly HMAHashBankService: Dependencies['HMAHashBankService'],
  ) {}

  /**
   * Validates and accepts a batch of items. Items go to the BullMQ queue (a
   * share of traffic set by ITEM_QUEUE_TRAFFIC_PERCENTAGE) or are processed in
   * this process by `processInline`, which the caller runs after responding.
   */
  async submitItems(
    orgId: string,
    { items }: SubmitItemsInput,
  ): Promise<{ status: 202 | 500; processInline?: () => Promise<void> }> {
    const {
      ContentApiLogger,
      RuleEngine,
      ModerationConfigService,
      Tracer,
      ItemInvestigationService,
      getItemTypeEventuallyConsistent,
      Meter,
      itemSubmissionQueueBulkWrite,
      HMAHashBankService,
    } = this;
    // Generate an id for this request to correlate logs. It doesn't need to be
    // random for security (i.e., uuidv4), and making it time-based could
    // actually be convenient, so that's what we do. We'll eventually get much
    // more sophisticated about how we pass this around (continuation local
    // storage? injected logger instances?), but this is fine for now.
    const requestId = toCorrelationId({ type: 'post-items', id: uuidv1() });

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

        if (itemSubmission.itemSubmission && !itemSubmission.error) {
          await addHashesToImageFields({
            itemType: itemSubmission.itemSubmission.itemType,
            data: itemSubmission.itemSubmission.data,
            orgId,
            HMAHashBankService,
          });
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
      throw new AggregateError(errors);
    }

    // Send a configurable percentage of traffic to the async processing queue
    // (BullMQ), otherwise handle inline (in this process, immediately after
    // returning 202 to the user). Set to 1 to route all traffic through the queue.
    const trafficPercentage = Number(
      safeGetEnvVar('ITEM_QUEUE_TRAFFIC_PERCENTAGE'),
    );
    if (Math.random() < trafficPercentage) {
      // toItemSubmission should always set a `submissionTime` property with a
      // valid Date, but due to legacy data the type returned, ItemSubmission, an
      // optional `submissionTime` property. this variable is used to convince
      // typescript that the value we subsequently pass to itemSubmissionQueueBulkWrite has
      // a valid Date in the `submissionTime` property.
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
        } satisfies ItemSubmissionMessageValue;
      });

      Meter.itemsEnqueued.add(submissionsToProcess.length);
      let enqueueFailed = false;
      await Tracer.addActiveSpan(
        {
          resource: 'SubmitItems',
          operation: 'itemSubmissionQueueBulkWrite',
        },
        async (span) => {
          const bulkWriteResponse =
            await itemSubmissionQueueBulkWrite(submissionsToProcess);
          if (bulkWriteResponse.error) {
            span.recordException(
              bulkWriteResponse.results.find(
                (response) => response instanceof Error,
              ) ??
                new Error(
                  'Unknown error in bulk write to item submission queue',
                ),
            );
            enqueueFailed = true;
          }
        },
      );

      return { status: enqueueFailed ? 500 : 202 };
    }

    // Respond 202 now that validation is complete; the caller then runs this.
    const processInline = async () => {
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
    };
    return { status: 202, processInline };
  }
}
