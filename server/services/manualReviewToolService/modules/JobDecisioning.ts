/* eslint-disable max-lines */
import { sql, type Kysely } from 'kysely';
import { match } from 'ts-pattern';
import { type JsonObject } from 'type-fest';

import { type Dependencies } from '../../../iocContainer/index.js';
import { filterNullOrUndefined } from '../../../utils/collections.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isNonEmptyString } from '../../../utils/typescript-types.js';
import { getFieldValueForRole } from '../../itemProcessingService/index.js';
import { type NCMECMediaReport } from '../../ncmecService/ncmecReporting.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';
import { type GetActionsByIdEventuallyConsistent } from '../manualReviewToolQueries.js';
import {
  type JobId,
  type ManualReviewAppealJob,
  type ManualReviewJob,
  type ManualReviewJobEnqueueSourceInfo,
  type ReportHistory,
} from '../manualReviewToolService.js';
import type ManualReviewToolSettings from './ManualReviewToolSettings.js';
import type QueueOperations from './QueueOperations.js';
import { jobIdToGuid } from './QueueOperations.js';

export type ManualReviewDecisionRelatedAction = {
  actionIds: readonly string[];
  itemIds: readonly string[];
  itemTypeId: string;
  policyIds: readonly string[];
};

export type NCMECReportedContentInThread = {
  contentId: string;
  contentTypeId: string;
  content?: string | null;
  creatorId: string;
  targetId: string;
  sentAt: string | Date;
  type: string;
  chatType: string;
  ipAddress: {
    ip: string;
    port?: number | null;
  };
};

export type NCMECThreadReport = {
  threadId: string;
  threadTypeId: string;
  reportedContent: readonly NCMECReportedContentInThread[];
};

type MRTJobAutoCloseReason = 'ITEM_DELETED_BEFORE_REVIEW';

export type ManualReviewDecisionComponent =
  | { type: 'IGNORE' }
  | {
      type: 'REJECT_APPEAL';
      appealId: string;
    }
  | {
      type: 'ACCEPT_APPEAL';
      appealId: string;
    }
  | {
      type: 'CUSTOM_ACTION';
      actions: readonly {
        id: string;
      }[];
      policies: readonly { id: string }[];
      itemIds: readonly string[];
      itemTypeId: string;
      actionIdsToMrtApiParamDecisionPayload?: JsonObject;
    }
  | {
      type: 'SUBMIT_NCMEC_REPORT';
      reportedMedia: readonly NCMECMediaReport[];
      reportedMessages: readonly NCMECThreadReport[];
      incidentType: string;
      escalateToHighPriority?: string;
      additionalInfo?: string;
    }
  | {
      type: 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE';
      newJobKind: 'NCMEC' | 'DEFAULT';
      originalQueueId?: string | null;
      newQueueId?: string | null;
    }
  | {
      type: 'AUTOMATIC_CLOSE';
      reason: MRTJobAutoCloseReason;
    };

export type ManualReviewDecisionType =
  | ManualReviewDecisionComponent['type']
  | 'RELATED_ACTION';

export type SubmitDecisionInput = {
  queueId: string;
  reportHistory: ReportHistory;
  jobId: JobId;
  lockToken: string;
  relatedActions: ManualReviewDecisionRelatedAction[];
  orgId: string;
  decisionReason?: string;
} & (
  | {
      automaticCloseDecision: {
        type: 'AUTOMATIC_CLOSE';
        reason: MRTJobAutoCloseReason;
      };
      decisionComponents?: undefined;
      reviewerEmail?: undefined;
      reviewerId?: undefined;
    }
  | {
      automaticCloseDecision?: undefined;
      decisionComponents: ManualReviewDecisionComponent[];
      reviewerId: string;
      reviewerEmail: string;
    }
);

export type OnRecordDecisionInput = {
  relatedActions: readonly ManualReviewDecisionRelatedAction[];
  job: ManualReviewJob | ManualReviewAppealJob;
  queueId: string;
  decisionComponents: ManualReviewDecisionComponent[];
  reviewerId: string;
  reviewerEmail: string;
  decisionReason?: string;
};

export default class JobDecisioning {
  constructor(
    private readonly queueOps: QueueOperations,
    private readonly pgQuery: Kysely<ManualReviewToolServicePg>,
    readonly getCustomActionsByIds: GetActionsByIdEventuallyConsistent,
    readonly onRecordDecision: (params: OnRecordDecisionInput) => Promise<void>,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly manualReviewToolSettings: ManualReviewToolSettings,
  ) {}

  async submitDecision(opts: SubmitDecisionInput) {
    const {
      queueId,
      lockToken,
      decisionComponents,
      reviewerId,
      reviewerEmail,
      orgId,
      jobId,
      relatedActions,
      decisionReason,
      automaticCloseDecision,
    } = opts;

    const [job] = await this.queueOps.getJobs({
      orgId,
      queueId,
      jobIds: [jobId],
    });

    // If job id is not found in the queue, assume it was already acted on.
    // It could also have never existed, and we could actually check to see
    // if there's a decision to discriminate between these cases, but that's
    // overkill. (Because we're not doing that, the NoJobWithIdInQueueError
    // error case is unused currently/for now.)

    if ((job as typeof job | undefined) == null) {
      throw makeJobHasAlreadyBeenSubmittedError({
        detail: `Job ${jobId} has already been acted on (or this job never existed).`,
        shouldErrorSpan: true,
      });
    }
    const decisions = decisionComponents ?? [automaticCloseDecision];

    // If the decision included some actionIds or policyIds, we want to verify
    // that those ids actually correspond to known actions/policies in the org
    // (for security) before we save the data to the db. We accept that there
    // could be some legit policies/actions that are very rarely not found
    // (from eventually consistent pg lookup) as a reasonable tradeoff.
    const customActionDecisions = decisions.flatMap((decision) =>
      decision.type === 'CUSTOM_ACTION' ? [decision] : [],
    );
    if (customActionDecisions.length > 0) {
      const allActionIds = customActionDecisions.flatMap((decision) =>
        decision.actions.map((action) => action.id),
      );
      const validActions = await this.getCustomActionsByIds({
        ids: allActionIds,
        orgId,
      });
      // We only throw if there aren't any valid actions.
      if (validActions.length === 0) {
        throw makeSubmittedJobActionNotFoundError({ shouldErrorSpan: true });
      }

      // Enforce `requires_policy_for_decisions` server-side. The MRT UI already
      // disables submit when this is on, but API/script callers can bypass that.
      // Only check the flag when there's actually a policy-less decision to
      // enforce against, so the common path avoids the extra DB hit. The check
      // only fires for CUSTOM_ACTION decisions, so it applies even on NCMEC
      // jobs that mix in a CUSTOM_ACTION (e.g. issuing a strike alongside an
      // NCMEC ignore or report).
      const hasEmptyPolicyCustomAction = customActionDecisions.some(
        (decision) => decision.policies.length === 0,
      );
      if (hasEmptyPolicyCustomAction) {
        const requiresPolicy =
          await this.manualReviewToolSettings.getRequiresPolicyForDecisions(
            orgId,
          );
        if (requiresPolicy) {
          throw makeMissingRequiredPolicyForDecisionError({
            shouldErrorSpan: true,
          });
        }
      }
    }

    // Enforce `mrt_requires_decision_reason` server-side. The MRT UI already
    // disables submit when this is on, but API/script callers can bypass that.
    // Skip the AUTOMATIC_CLOSE path (no moderator, no reason to require) and
    // only read the flag when there's actually a missing reason to enforce
    // against, so the common path does no extra DB work. Matches the client
    // gate at ManualReviewJobReview.tsx, which uses isNonEmptyString.
    //
    // Bypass the check when the decision is NCMEC-native (Submit NCMEC Report
    // or Ignore on an NCMEC job, no CUSTOM_ACTION mixed in): those decisions
    // don't carry a written reason and the flag is irrelevant for them. A
    // CUSTOM_ACTION on an NCMEC job still requires a reason. See #736.
    const isNcmecNativeDecision =
      job.payload.kind === 'NCMEC' && customActionDecisions.length === 0;
    if (
      decisionComponents != null &&
      !isNonEmptyString(decisionReason) &&
      !isNcmecNativeDecision
    ) {
      const requiresReason =
        await this.manualReviewToolSettings.getRequiresDecisionReason(orgId);
      if (requiresReason) {
        throw makeMissingRequiredDecisionReasonError({
          detail: 'This org requires every decision to include a reason.',
          shouldErrorSpan: true,
        });
      }
    }

    const removeJob = async () =>
      this.queueOps.removeJob({
        orgId,
        queueId,
        jobId,
        lockToken,
      });

    const logDecision = async () =>
      this.#logDecision({
        id: jobIdToGuid(jobId),
        job,
        queueId,
        reviewerId,
        orgId,
        decisionComponents: decisions,
        relatedActions,
        enqueueSourceInfo: job.enqueueSourceInfo,
        decisionReason,
      });

    // When a job decision is submitted, we want to record the decision (in pg)
    // and remove the job from redis. Those two actions are not atomic, so we
    // need an error handling strategy that makes them appear roughly atomic.
    //
    // The worst case would be for a job to be deleted from the queue and its
    // decision not get recorded (e.g., if the server crashes), as then the job
    // would be lost for good and there'd never be a way to act on it. So, to
    // avoid that case, we always attempt to log the decision first, and only
    // remove the job once the decision is saved. Given that, the cases are:
    //
    // 1. logDecision() succeeds; then, removeJob() succeeds. All good.
    //
    // 2. logDecision() succeeds; then, removeJob() fails. This is the
    //    trickiest case. The job is still in the queue and could be dequeued
    //    again, but the decision's already logged. I _think_ the only way to
    //    perfectly-reliably handle/avoid this case would be to use a "pending
    //    decisions" table, plus a background worker that eventually moves
    //    "pending decisions" to "applied decisions" if the corresponding job
    //    has been removed from redis. While that seems like it could be made
    //    bulletproof(?), it's way too involved. (Note: the server moving
    //    "pending" decisions to "applied" after deleting the job from redis
    //    wouldn't be totally reliable, as it could crash between those steps.)
    //
    //    So, instead, we throw a generic "decision couldn't be logged" error;
    //    this reflects that the job is still in the queue, and the client
    //    should retry submitting the decision. When they do, they'll get a
    //    "decision already submitted" error (see below), which they can ignore.
    //    This is a bit weird from the client's POV -- it allows a sequence of
    //    events in which the decision appears to have failed to save, but then
    //    shows up as having already been saved, even if no one else acted on
    //    the job in the meantime. Nevertheless, it works well enough (and this
    //    sort of logical anomaly is one clients should expect anyway, as it
    //    could also happen if a concurrent user acted on the job after the
    //    client's lock expired).
    //
    // 3. logDecision() fails because the decision's already been logged; then,
    //    removeJob() succeeds. If we're in this case, it means that
    //    logDecision() previously succeeded, but then removeJob() failed,
    //    and now the client's retrying (per case 2 above). So, we throw the
    //    "already submitted" error mentioned above, for the client to ignore.
    //
    // 4. logDecision() fails because the decision's already been logged; then,
    //    removeJob() fails. Again, this must mean that we were in case 2
    //    and retried. But, because `removeJob()` failed, we can throw the
    //    same "decision couldn't be logged" error from case 2 again.
    //
    // 5. logDecision() fails for another reason (e.g., pg down), so
    //    removeJob() is not called. This is a simple path, because at
    //    least redis and pg are still in agreement that the job is incomplete.
    //    So we just throw the same "decision couldn't be logged" error from
    //    case 2, so the client will retry.
    //
    // The code below attempts to log the job decision, remove the job from
    // redis, handle all the error cases above, and return whether a new
    // decision was stored and any error that needs to be thrown.
    const { error, newDecisionStored } = await (async () => {
      const [logDecisionStatus, logDecisionErr] = await logDecision().then(
        () => ['SUCCESS'] as const,
        (error: unknown) =>
          isDecisionAlreadyLoggedError(error)
            ? (['ALREADY_LOGGED'] as const)
            : (['FAILED', error] as const),
      );

      // Case 5. Handle this first, because it's special in that we want to bail
      // without even calling removeJob() if logDecision() failed.
      if (logDecisionStatus === 'FAILED') {
        return {
          newDecisionStored: false,
          error: makeRecordingJobDecisionFailedError({
            detail: `The decision for job ${jobId} was not recorded. Please try again.`,
            cause: logDecisionErr,
            shouldErrorSpan: true,
          }),
        };
      }

      // logDecision() succeeded (now or previously), so call removeJob().
      const [removeJobStatus, removeJobErr] = await removeJob().then(
        () => ['SUCCESS'] as const,
        (e: unknown) => ['FAILED', e] as const,
      );

      const decisioningFailedError = makeRecordingJobDecisionFailedError({
        detail: `The decision for job ${jobId} was not recorded. Please try again.`,
        cause: removeJobErr,
        shouldErrorSpan: true,
      });

      const jobAlreadySubmittedError = makeJobHasAlreadyBeenSubmittedError({
        detail: `Job ${jobId} has already been acted on.`,
        shouldErrorSpan: true,
      });

      return {
        newDecisionStored: logDecisionStatus === 'SUCCESS',
        error: match([logDecisionStatus, removeJobStatus] as const)
          // Case 1, happy path.
          .with(['SUCCESS', 'SUCCESS'], () => undefined)
          // Case 2, decision logged but job not deleted.
          .with(['SUCCESS', 'FAILED'], () => decisioningFailedError)
          // Case 3, client retrying after failed job deletion; deletion worked now.
          .with(['ALREADY_LOGGED', 'SUCCESS'], () => jobAlreadySubmittedError)
          // Case 4, client retrying after failed job deletion; deletion failed again.
          .with(['ALREADY_LOGGED', 'FAILED'], () => decisioningFailedError)
          .exhaustive(),
      };
    })();

    // Currently we have no extra steps to perform on an automatic closure,
    // so we can skip the onRecordDecisionCall
    // TODO: start sending automatic close decisions when we are sending the
    // report decision callbacks
    if (newDecisionStored && automaticCloseDecision === undefined) {
      // TODO: use proper publishing to a durable queue and retry
      this.onRecordDecision({
        decisionComponents,
        relatedActions,
        job,
        queueId,
        reviewerId,
        reviewerEmail,
        decisionReason,
      }).catch((error) => {
        this.tracer.addSpan(
          { resource: 'actionPublisher', operation: 'publishAction' },
          (span) => {
            span.setAttribute('job.id', job.id);
            span.setAttribute('org.id', job.orgId);
            this.tracer.logSpanFailed(span, error);
            return null;
          },
        );
      });
    }
    // TODO:
    // call new reporting service `reportDecision` method.
    // theoretically this could live in the onRecordDecision method, but that is
    // a nightmare as it is and I'd rather have it handled by the reporting
    // service

    if (error) {
      throw error;
    }
  }

  async #logDecision(opts: {
    id: string;
    job: ManualReviewJob;
    queueId: string;
    reviewerId?: string;
    orgId: string;
    decisionComponents: ManualReviewDecisionComponent[];
    relatedActions: ManualReviewDecisionRelatedAction[];
    enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
    decisionReason?: string;
  }) {
    const {
      id,
      job,
      queueId,
      reviewerId,
      orgId,
      decisionComponents,
      relatedActions,
      enqueueSourceInfo,
      decisionReason,
    } = opts;

    const itemType = await this.moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: job.payload.item.itemTypeIdentifier,
    });

    const itemCreatedAtField = itemType
      ? getFieldValueForRole(
          itemType.schema,
          itemType.schemaFieldRoles,
          'createdAt',
          job.payload.item.data,
        )
      : null;
    const itemCreatedAt = itemCreatedAtField
      ? new Date(itemCreatedAtField)
      : null;

    return this.pgQuery
      .insertInto('manual_review_tool.manual_review_decisions')
      .values({
        id,
        job_payload: job,
        queue_id: queueId,
        reviewer_id: reviewerId,
        org_id: orgId,
        decision_components: decisionComponents,
        related_actions: relatedActions,
        enqueue_source_info: enqueueSourceInfo,
        item_created_at: itemCreatedAt,
        decision_reason: decisionReason,
      })
      .execute();
  }

  async getNcmecDecisions(opts: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = opts;
    const allNcmecDecisions = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .where(({ eb, selectFrom }) => {
        return eb.exists(
          selectFrom(
            sql`unnest(manual_review_tool.manual_review_decisions.decision_components)`.as(
              'decision_component',
            ),
          )
            .selectAll()
            .where(
              sql<string>`decision_component->>'type'`,
              '=',
              'SUBMIT_NCMEC_REPORT',
            ),
        );
      })
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .select([
        'org_id',
        'decision_components',
        'job_payload',
        'id',
        'queue_id',
        'reviewer_id',
      ])
      .execute();
    // There shouldn't be any decisions from deprecated job payload types, so
    // filter them out to satisfy ts
    return filterNullOrUndefined(
      allNcmecDecisions.map((it) => {
        if (
          'policyIds' in it.job_payload &&
          'submissionId' in it.job_payload.payload.item
        ) {
          return {
            ...it,
            job_payload: it.job_payload,
          };
        }
        return undefined;
      }),
    );
  }

  async getNcmecDecisionsForOrg(opts: { orgId: string; limit?: number }) {
    const { orgId } = opts;
    // Clamp `limit` so callers can't request an unreasonable number of rows;
    // default of 500 matches the previous behavior. Non-numeric values fall
    // back to the default via Number.isFinite.
    const requestedLimit = opts.limit ?? 500;
    const safeLimit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 500)
        : 500;
    const allNcmecDecisions = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .where('org_id', '=', orgId)
      .where(({ eb, selectFrom }) => {
        return eb.exists(
          selectFrom(
            sql`unnest(manual_review_tool.manual_review_decisions.decision_components)`.as(
              'decision_component',
            ),
          )
            .selectAll()
            .where(
              sql<string>`decision_component->>'type'`,
              '=',
              'SUBMIT_NCMEC_REPORT',
            ),
        );
      })
      .select([
        'org_id',
        'decision_components',
        'job_payload',
        'id',
        'queue_id',
        'reviewer_id',
        'created_at',
      ])
      .orderBy('created_at', 'desc')
      .limit(safeLimit)
      .execute();
    return filterNullOrUndefined(
      allNcmecDecisions.map((it) => {
        if (
          'policyIds' in it.job_payload &&
          'submissionId' in it.job_payload.payload.item
        ) {
          return { ...it, job_payload: it.job_payload };
        }
        return undefined;
      }),
    );
  }

  /** Single-decision lookup gated on the caller's org. Returns `undefined` if
   * the decision doesn't exist or belongs to a different org (callers should
   * treat both cases as "not found" — never confirm cross-org existence). */
  async getNcmecDecisionByIdForOrg(opts: {
    orgId: string;
    decisionId: string;
  }) {
    const { orgId, decisionId } = opts;
    const row = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_decisions')
      .where('id', '=', decisionId)
      .where('org_id', '=', orgId)
      .select([
        'org_id',
        'decision_components',
        'job_payload',
        'id',
        'queue_id',
        'reviewer_id',
        'created_at',
      ])
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    // Only return decisions that actually contain a SUBMIT_NCMEC_REPORT
    // component so callers get the same `not_found` shape for both
    // "wrong-org" and "wrong-decision-type" lookups.
    const hasNcmecComponent = row.decision_components.some(
      (component) => component.type === 'SUBMIT_NCMEC_REPORT',
    );
    if (!hasNcmecComponent) {
      return undefined;
    }
    if (
      !('policyIds' in row.job_payload) ||
      !('submissionId' in row.job_payload.payload.item)
    ) {
      return undefined;
    }
    return { ...row, job_payload: row.job_payload };
  }

  async getIgnoreCallbackForOrg(orgId: string): Promise<string | undefined> {
    const settings = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .select('ignore_callback_url as ignoreCallback')
      .executeTakeFirst();
    return settings?.ignoreCallback ?? undefined;
  }
}

/**
 * Returns whether an error is the pg error indicating that the decision's
 * already been logged.
 */
function isDecisionAlreadyLoggedError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      'duplicate key value violates unique constraint "manual_review_decisions_pkey"',
    )
  );
}

export type SubmitDecisionErrorType =
  | 'JobHasAlreadyBeenSubmittedError'
  | 'SubmittedJobActionNotFoundError'
  | 'NoJobWithIdInQueueError'
  | 'RecordingJobDecisionFailedError'
  | 'MissingRequiredDecisionReasonError'
  | 'MissingRequiredPolicyForDecisionError';

export const makeJobHasAlreadyBeenSubmittedError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'This job has already been submitted.',
    name: 'JobHasAlreadyBeenSubmittedError',
    ...data,
  });

export const makeRecordingJobDecisionFailedError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 500,
    type: [ErrorType.InternalServerError],
    title: 'The job decisioning has failed and should be retried.',
    name: 'RecordingJobDecisionFailedError',
    ...data,
  });

export const makeSubmittedJobActionNotFoundError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'Passed-in action ID not found.',
    name: 'SubmittedJobActionNotFoundError',
    ...data,
  });

export const makeNoJobWithIdInQueueError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 404,
    type: [ErrorType.NotFound],
    title: String(data.detail),
    name: 'NoJobWithIdInQueueError',
    ...data,
  });

export const makeMissingRequiredDecisionReasonError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title:
      'This org requires every decision to include a reason. Add a reason and resubmit.',
    name: 'MissingRequiredDecisionReasonError',
    ...data,
  });

export const makeMissingRequiredPolicyForDecisionError = (
  data: ErrorInstanceData,
) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title:
      'This org requires every decision to include at least one policy. Pick a policy and resubmit.',
    name: 'MissingRequiredPolicyForDecisionError',
    ...data,
  });
