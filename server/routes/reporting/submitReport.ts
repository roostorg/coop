import { type Exception } from '@opentelemetry/api';
import _ from 'lodash';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  rawItemSubmissionToItemSubmission,
  type ItemSubmission,
} from '../../services/itemProcessingService/index.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import {
  makeBadRequestError,
  makeInternalServerError,
} from '../../utils/errors.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { withRetries } from '../../utils/misc.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { isValidDate } from '../../utils/time.js';
import {
  type ReportItemInput,
  type ReportItemOutput,
} from './ReportingRoutes.js';

export default function submitReport({
  ReportingService,
  ManualReviewToolService,
  Tracer,
  getItemTypeEventuallyConsistent,
  NcmecService,
  ModerationConfigService,
  Meter,
  ItemInvestigationService,
  HMAHashBankService,
}: Dependencies): RequestHandlerWithBodies<ReportItemInput, ReportItemOutput> {
  // eslint-disable-next-line complexity
  return async (req, res, next) => {
    // Generate an id for this request to correlate logs. It doesn't need to be
    // random for security (i.e., uuidv4), and making it time-based could
    // actually be convenient, so that's what we do. We'll eventually get much
    // more sophisticated about how we pass this around (continuation local
    // storage? injected logger instances?), but this is fine for now.
    //
    // This reportId will also be given back to the user, and used for
    // correlation with appeals and report decisions.
    const reportId = uuidv1();
    const requestId = toCorrelationId({
      type: 'submit-report',
      id: reportId,
    });

    Meter.reportsCounter.add(1);

    try {
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

      const toItemSubmission = rawItemSubmissionToItemSubmission.bind(
        null,
        await ModerationConfigService.getItemTypes({
          orgId,
          directives: { maxAge: 10 },
        }),
        orgId,
        getItemTypeEventuallyConsistent,
      );

      // Now that we've at least loaded the item type, we'll log successes and
      // failures to snowflake from now on. This is the basic info we'll log.
      const reportedForReason = req.body.reportedForReason;
      const reporterIdentifier =
        req.body.reporter.kind === 'user'
          ? { id: req.body.reporter.id, typeId: req.body.reporter.typeId }
          : undefined;
      const reportedItem = req.body.reportedItem;

      // TODO: error handling. Our controllers still need much better error
      // handling abstractions.
      const thread = req.body.reportedItemThread;
      const additionalItems = req.body.additionalItems;
      const reportedItemSubmission = await toItemSubmission(reportedItem);

      if (
        Array.isArray(reportedItem.data.images) &&
        reportedItem.data.images.length > 0 &&
        !reportedItemSubmission.error
      ) {
        try {
          const images = reportedItem.data.images as string[];
          
          // Get all hash banks for this org once
          const allBanks = await HMAHashBankService.listBanks(orgId);
          const allBankNames = allBanks.map(bank => bank.hma_name);
          
          const imageHashes = await Promise.all(
            images.map(async (url) => {
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
          (reportedItemSubmission.itemSubmission.data as any).images = imageHashes;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to get HMA hashes for images:', error);
        }
      }

      const reportedThreadSubmission = thread
        ? await Promise.all(
            thread.map(async (message) => toItemSubmission(message)),
          )
        : undefined;
      const additionalItemSubmissions = additionalItems
        ? await Promise.all(
            additionalItems.map(async (message) => toItemSubmission(message)),
          )
        : undefined;

      // Check if there were any of the following error states and throw an aggregate error with them all:
      // 1. There were issues with the validation.
      // 2. There's an item in the thread that doesn't represent a Content Type
      const submittedItemIsInvalid = reportedItemSubmission.error !== undefined;

      const hasAdditionalItemsOnThreadSubmission = Boolean(
        additionalItemSubmissions &&
          additionalItemSubmissions.length > 0 &&
          reportedItemSubmission.error === undefined &&
          reportedItemSubmission.itemSubmission.itemType.kind === 'THREAD',
      );

      const isAllValidContentItems = (
        maybeItemSubmissions: Awaited<ReturnType<typeof toItemSubmission>>[],
      ): maybeItemSubmissions is {
        itemSubmission: ItemSubmission;
        error: undefined;
      }[] => {
        return maybeItemSubmissions.every(
          (it) => !it.error && it.itemSubmission.itemType.kind === 'CONTENT',
        );
      };

      // We disable this lint rule here and below because using `??` here would
      // match the intended semantics less well/be less clear, but casting these
      // expressions to strict booleans with Boolean() confuses TS control flow
      // analysis.
      const threadOrAdditionalItemsHadInvalidOrIllegalItems =
        (reportedThreadSubmission &&
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !isAllValidContentItems(reportedThreadSubmission)) ||
        (additionalItemSubmissions &&
          !isAllValidContentItems(additionalItemSubmissions));

      const isInvalidReportedAtDate = !isValidDate(
        new Date(req.body.reportedAt),
      );
      if (
        submittedItemIsInvalid ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        threadOrAdditionalItemsHadInvalidOrIllegalItems ||
        hasAdditionalItemsOnThreadSubmission ||
        isInvalidReportedAtDate
      ) {
        return next(
          new AggregateError(
            [
              submittedItemIsInvalid ? reportedItemSubmission.error : [],
              reportedThreadSubmission
                ? reportedThreadSubmission.flatMap(
                    (it) => it.error?.errors ?? [],
                  )
                : [],
              hasAdditionalItemsOnThreadSubmission
                ? [
                    makeBadRequestError(
                      `Invalid report containing additional items on a Thread type.`,
                      { shouldErrorSpan: true },
                    ),
                  ]
                : [],
              threadOrAdditionalItemsHadInvalidOrIllegalItems
                ? [
                    makeBadRequestError(
                      `Invalid report containing a thread or additional items containing items that aren't entirely Content Types`,
                      { shouldErrorSpan: true },
                    ),
                  ]
                : [],
              isInvalidReportedAtDate
                ? [
                    makeBadRequestError(`Invalid reportedAt time`, {
                      shouldErrorSpan: true,
                    }),
                  ]
                : [],
            ].flat(),
          ),
        );
      }

      const report = {
        reportId,
        requestId,
        orgId,
        reporter: req.body.reporter,
        reportedAt: new Date(req.body.reportedAt),
        reportedForReason: reportedForReason
          ? {
              policyId: reportedForReason.policyId ?? undefined,
              reason: reportedForReason.reason ?? undefined,
            }
          : undefined,
        reportedItem: reportedItemSubmission.itemSubmission,
        reportedItemThread: reportedThreadSubmission?.map(
          (it) => it.itemSubmission,
        ),
        reportedItemsInThread: req.body.reportedItemsInThread,
        additionalItemSubmissions:
          additionalItemSubmissions?.map((it) => it.itemSubmission) ?? [],
        skipJobEnqueue: true,
      };

      // Insert the item and any additionalItems into the
      // itemInvestigationService, so that it is preserved and can be present
      // for context on future reports that have some relationship to it
      try {
        await Promise.all(
          [reportedItemSubmission, ...(additionalItemSubmissions ?? [])].map(
            async (item) => {
              await ItemInvestigationService.insertItem({
                orgId,
                requestId,
                itemSubmission: {
                  ...item.itemSubmission,
                  submissionTime:
                    item.itemSubmission.submissionTime ?? new Date(),
                },
              });
            },
          ),
        );
      } catch {
        // Do nothing, as failing to insert does not affect report generation
      }

      await ReportingService.submitReport(report);

      // send response as soon as
      // the report has successfully been written to snowflake
      res.status(201).json({ reportId }).end();

      if (!req.body.reportedForReason?.csam) {
        // Run reporting rules over all submitted items
        const allItemsForReportingRules = [
          reportedItemSubmission,
          ...(reportedThreadSubmission ?? []),
        ].map((it) => it.itemSubmission);

        Meter.itemSubmissionsCounter.add(allItemsForReportingRules.length);

        await Promise.all(
          allItemsForReportingRules.map(async (item) => {
            await ReportingService.runEnabledRules(item, requestId);
          }),
        ).catch((e) => {
          // eslint-disable-next-line no-console
          console.error('Failed to run reporting rules:', e);
          const activeSpan = Tracer.getActiveSpan();
          if (activeSpan?.isRecording()) {
            activeSpan.recordException(e as Exception);
          }
        });
      }

      // Enqueue the Job to the BullMQ MRT job queue
      try {
        await Tracer.addSpan(
          {
            resource: 'POST /report',
            operation: 'enqueueJobToMRT',
          },
          async (span) => {
            const item = itemSubmissionToItemSubmissionWithTypeIdentifier(
              reportedItemSubmission.itemSubmission,
            );
            span.setAttribute('report.orgId', orgId);
            span.setAttribute('report.item', item.itemId);
            span.setAttribute('report.itemTypeId', item.itemTypeIdentifier.id);

            const enqueueWithRetries = withRetries(
              {
                maxRetries: 5,
                initialTimeMsBetweenRetries: 5,
                maxTimeMsBetweenRetries: 500,
                jitter: true,
              },
              async () => {
                const commonEnqueueInput = {
                  createdAt: report.reportedAt,
                  orgId,
                  enqueueSource: 'REPORT' as const,
                  enqueueSourceInfo: { kind: 'REPORT' } as const,
                  policyIds: reportedForReason?.policyId
                    ? [reportedForReason.policyId]
                    : [],
                };
                if (
                  req.body.reportedForReason?.csam
                ) {
                  await NcmecService.enqueueForHumanReviewIfApplicable({
                    ...commonEnqueueInput,
                    item,
                    correlationId: requestId,
                  });
                  return;
                }
                await ManualReviewToolService.enqueue({
                  ...commonEnqueueInput,
                  // We assume that this is a user type and that the proper
                  // validation was done before it was put into the reporting
                  // table
                  correlationId: requestId,
                  payload: {
                    item,
                    kind: 'DEFAULT',
                    ...{
                      reportHistory: [
                        {
                          reason: reportedForReason?.reason ?? undefined,
                          reporterId: reporterIdentifier,
                          reportId,
                          reportedAt: report.reportedAt,
                          policyId: reportedForReason?.policyId ?? undefined,
                        },
                      ],
                    },
                    ...{
                      reportedForReasons: [
                        {
                          reason: reportedForReason?.reason ?? undefined,
                          reporterId: reporterIdentifier,
                        },
                      ],
                    },
                    ...(report.reportedItemThread
                      ? {
                          itemThreadContentItems: report.reportedItemThread.map(
                            (it) =>
                              itemSubmissionToItemSubmissionWithTypeIdentifier(
                                it,
                              ),
                          ),
                        }
                      : {}),
                    ...(additionalItemSubmissions
                      ? {
                          additionalContentItems: additionalItemSubmissions.map(
                            (it) =>
                              itemSubmissionToItemSubmissionWithTypeIdentifier(
                                it.itemSubmission,
                              ),
                          ),
                        }
                      : {}),
                    ...(req.body.reportedItemsInThread
                      ? { reportedItems: req.body.reportedItemsInThread }
                      : {}),
                  },
                });
              },
            );
            await enqueueWithRetries();
          },
        );
        // Do nothing on error, as the span will already be marked as failed
      } catch {}
      // this error handling only triggers on errors before the `res.sendStatus` call
    } catch (e: unknown) {
      const activeSpan = Tracer.getActiveSpan();
      if (activeSpan?.isRecording()) {
        activeSpan.recordException(e as Exception);
      }
      return next(
        makeInternalServerError('Failed to send report to reporting service', {
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }
  };
}
