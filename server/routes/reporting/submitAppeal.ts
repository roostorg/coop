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
import { withRetries } from '../../utils/misc.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { isValidDate } from '../../utils/time.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import {
  type AppealItemInput,
  type AppealItemOutput,
} from './ReportingRoutes.js';

export default function submitAppeal({
  ReportingService,
  ManualReviewToolService,
  Tracer,
  getItemTypeEventuallyConsistent,
  ModerationConfigService,
  Meter,
  ItemInvestigationService,
}: Dependencies): RequestHandlerWithBodies<AppealItemInput, AppealItemOutput> {
  // eslint-disable-next-line complexity
  return async (req, res, next) => {
    // Generate an id for this request to correlate logs. It doesn't need to be
    // random for security (i.e., uuidv4), and making it time-based could
    // actually be convenient, so that's what we do. We'll eventually get much
    // more sophisticated about how we pass this around (continuation local
    // storage? injected logger instances?), but this is fine for now.
    const requestId = toCorrelationId({
      type: 'submit-appeal',
      id: uuidv1(),
    });

    Meter.appealsCounter.add(1);

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
      const appealReason = req.body.appealReason;
      const appealerIdentifier = {
        id: req.body.appealedBy.id,
        typeId: req.body.appealedBy.typeId,
      };
      const reportedItem = req.body.actionedItem;
      // TODO: error handling. Our controllers still need much better error
      // handling abstractions.
      const additionalItems = req.body.additionalItems;
      const actionsTaken = req.body.actionsTaken;
      const reportedItemSubmission = await toItemSubmission(reportedItem);

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

      const threadOrAdditionalItemsHadInvalidOrIllegalItems =
        additionalItemSubmissions &&
        !isAllValidContentItems(additionalItemSubmissions);

      const isInvalidAppealedAtDate = !isValidDate(
        new Date(req.body.appealedAt),
      );

      const orgActions = (
        await ModerationConfigService.getActions({
          orgId,
          readFromReplica: true,
        })
      ).map((it) => it.id);
      const invalidActionIds = actionsTaken.filter(
        (id) => !orgActions.includes(id),
      );

      if (
        submittedItemIsInvalid ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        threadOrAdditionalItemsHadInvalidOrIllegalItems ||
        hasAdditionalItemsOnThreadSubmission ||
        isInvalidAppealedAtDate ||
        invalidActionIds.length > 0
      ) {
        return next(
          new AggregateError(
            [
              submittedItemIsInvalid ? reportedItemSubmission.error : [],
              hasAdditionalItemsOnThreadSubmission
                ? [
                    makeBadRequestError(
                      `Invalid appeal containing additional items on a Thread type.`,
                      { shouldErrorSpan: true },
                    ),
                  ]
                : [],
              threadOrAdditionalItemsHadInvalidOrIllegalItems
                ? [
                    makeBadRequestError(
                      `Invalid appeal containing a thread or additional items containing items that aren't entirely Content Types`,
                      { shouldErrorSpan: true },
                    ),
                  ]
                : [],
              isInvalidAppealedAtDate
                ? [
                    makeBadRequestError(`Invalid appealedAt time`, {
                      shouldErrorSpan: true,
                    }),
                  ]
                : [],
              invalidActionIds.length > 0
                ? invalidActionIds.map((id) =>
                    makeBadRequestError(
                      `Couldn\'t find an Item Type for your org with ID: ${id}`,
                      { shouldErrorSpan: true },
                    ),
                  )
                : [],
            ].flat(),
          ),
        );
      }

      const appeal = {
        //This ID is meant to be the user's internal ID for the appeal, which
        //we we will propagate back to the user on any action callbacks that result
        //from the appeal review.
        appealId: req.body.appealId,
        requestId,
        orgId,
        violatingPolicies: req.body.violatingPolicies,
        appealedBy: req.body.appealedBy,
        appealedAt: new Date(req.body.appealedAt),
        appealReason,
        actionsTaken,
        actionedItem: reportedItemSubmission.itemSubmission,
        additionalItemSubmissions:
          additionalItemSubmissions?.map((it) => it.itemSubmission) ?? [],
        skipJobEnqueue: true,
      };

      // Insert the item into the itemInvestigationService, so that it is
      // preserved and can be present for context on future reports or appeals
      // that have some relationship to it
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

      await ReportingService.submitAppeal(appeal);

      // send response as soon as
      // the report has successfully been written to snowflake
      res.sendStatus(204);

      // Enqueue the Job to the BullMQ MRT job queue
      try {
        await Tracer.addSpan(
          {
            resource: 'POST /report/appeal',
            operation: 'enqueueAppealToMRT',
          },
          async (span) => {
            const item = itemSubmissionToItemSubmissionWithTypeIdentifier(
              reportedItemSubmission.itemSubmission,
            );
            span.setAttribute('appeal.orgId', orgId);
            span.setAttribute('appeal.item', item.itemId);
            span.setAttribute('appeal.itemTypeId', item.itemTypeIdentifier.id);

            const enqueueWithRetries = withRetries(
              {
                maxRetries: 5,
                initialTimeMsBetweenRetries: 5,
                maxTimeMsBetweenRetries: 500,
                jitter: true,
              },
              async () => {
                const commonEnqueueInput = {
                  createdAt: appeal.appealedAt,
                  orgId,
                  enqueueSource: 'APPEAL' as const,
                  enqueueSourceInfo: { kind: 'APPEAL' } as const,
                  policyIds: appeal.violatingPolicies?.map((it) => it.id) ?? [],
                };
                await ManualReviewToolService.enqueueAppeal({
                  ...commonEnqueueInput,
                  // We assume that this is a user type and that the proper
                  // validation was done before it was put into the reporting
                  // table
                  correlationId: requestId,
                  payload: {
                    item,
                    kind: 'APPEAL',
                    appealId: appeal.appealId,
                    actionsTaken: appeal.actionsTaken,
                    appealReason: appeal.appealReason,
                    appealerIdentifier,
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
        makeInternalServerError('Failed to send appeal to reporting service', {
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }
  };
}
