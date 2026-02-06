/* eslint-disable max-lines */

import { SpanStatusCode } from '@opentelemetry/api';
import { type ConsumerDirectives } from '../../lib/cache/index.js';
import { type ItemIdentifier } from '@roostorg/types';
import { type Kysely } from 'kysely';
import _ from 'lodash';
import { type Opaque } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  type Invoker,
  type UserPermission,
} from '../../models/types/permissioning.js';
import { jsonStringify } from '../../utils/encoding.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { isUniqueViolationError } from '../../utils/kysely.js';
import type { OmitEach, ReplaceDeep } from '../../utils/typescript-types.js';
import {
  getFieldValueForRole,
  getFieldValueOrValues,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type ModerationConfigService } from '../moderationConfigService/index.js';
import { type PartialItemsService } from '../partialItemsService/index.js';
import {
  type UserScore,
  type UserStatisticsService,
} from '../userStatisticsService/userStatisticsService.js';
import { type ManualReviewToolServicePg } from './dbTypes.js';
import AppealsJobRouting from './modules/AppealsJobRouting.js';
import CommentOperations from './modules/CommentOperations.js';
import DecisionAnalytics, {
  type DecisionCountsInput,
  type DecisionCountsTableInput,
  type JobCountsInput,
  type JobCreationsInput,
  type RecentDecisionsFilterInput,
  type TimeToActionInput,
} from './modules/DecisionAnalytics.js';
import JobDecisioning, {
  type OnRecordDecisionInput,
  type SubmitDecisionInput,
} from './modules/JobDecisioning.js';
import JobEnrichment, {
  type ManualReviewAppealJobInput,
  type ManualReviewJobInput,
} from './modules/JobEnrichment.js';
import JobRendering from './modules/JobRendering.js';
import JobRouting, {
  type CreateRoutingRuleInput,
  type ReorderRoutingRulesInput,
  type RoutingRuleWithoutVersion,
  type UpdateRoutingRuleInput,
} from './modules/JobRouting.js';
import ManualReviewToolSettings from './modules/ManualReviewToolSettings.js';
import QueueOperations, {
  type ManualReviewQueue,
} from './modules/QueueOperations.js';
import SkipOperations, {
  type SkippedJobCountInput,
} from './modules/SkipOperations.js';

// An id that's unique across all jobs ever added to any queue (pending or not).
// This is the id that's passed into the MRT Service by callers to identify a
// job, and that's exposed to callers when a job is returned from this service.
// Note that this is not the same as the id of the job within Bull, which is
// managed as an implementation detail of the QueueOperations submodule. That
// module creates these JobId values when a Job is added to Bull.
export type JobId = Opaque<string, 'JobId'>;

export type ManualReviewJob = {
  id: JobId;
  orgId: string;
  createdAt: Date;
  payload: ManualReviewJobPayload;
  reenqueuedFrom?: OriginJobInfo;
  enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
  // NB: represents the policy under which the job was added (e.g., the policy
  // it was reported for violating.
  policyIds: string[];
};

export type ManualReviewAppealJob = {
  id: JobId;
  orgId: string;
  createdAt: Date;
  payload: ManualReviewAppealJobPayload;
  reenqueuedFrom?: OriginJobInfo;
  enqueueSourceInfo?: AppealEnqueueSourceInfo;
  // NB: represents the policy under which the job was added (e.g., the policy
  // it was reported for violating.
  policyIds: string[];
};

export type ManualReviewJobOrAppeal = ManualReviewJob | ManualReviewAppealJob;

// Old MRT jobs (created before roughly Sept 2023) included this
// "LegacyItemWithTypeIdentifier" type in their payloads, rather than including
// full `ItemSubmissionWithTypeIdentifier` objects. While these these jobs will
// cycle out of redis over time, their payload was also saved forever in
// postgres (in the decisions table), so we can't remove this type and update
// the `ManualReviewJobPayload` type until _both_ all the old jobs have been
// dequeued from redis and we've manually migrated the records in the decisions
// table. We should do that soon because synthesizing submissionIds from the
// postgres decisions _on read_ is a little sketch (the synthesized ids won't be
// stable across reads and will have the wrong embedded date if we aren't
// careful.)
export type LegacyItemWithTypeIdentifier = {
  id: string;
  data: NormalizedItemData;
  typeIdentifier: {
    id: string;
    version: string;
    schemaVariant: 'original' | 'partial';
  };
};

// The type of stored, legacy MRT jobs -- in both redis and the pg decisions
// table -- per comment above.
// TODO: migrate and delete. Also delete the date filter in getDecidedJob().
export type StoredManualReviewJob =
  | ManualReviewJob
  | ReplaceDeep<
      Omit<ManualReviewJob, 'policyIds' | 'payload'> & {
        payload: ManualReviewJobPayload & {
          policyId?: string;
        };
      },
      ItemSubmissionWithTypeIdentifier,
      LegacyItemWithTypeIdentifier | ItemSubmissionWithTypeIdentifier
    >;

export type ReportHistory = Array<{
  reporterId?: ItemIdentifier;
  reason?: string;
  reportId: string;
  reportedAt: Date;
  policyId?: string;
}>;

export type ContentManualReviewJobPayload = {
  kind: 'DEFAULT';
  item: ItemSubmissionWithTypeIdentifier;
  userScore?: UserScore;
  itemThreadContentItems?: ItemSubmissionWithTypeIdentifier[];
  additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
  reportedForReason?: string;
  reporterIdentifier?: ItemIdentifier;
  reportedForReasons?: Array<{ reporterId?: ItemIdentifier; reason?: string }>;
  enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
  reportHistory: ReportHistory;
};

export type UserManualReviewJobPayload = {
  kind: 'DEFAULT';
  item: ItemSubmissionWithTypeIdentifier;
  userScore?: UserScore;
  itemThreadContentItems?: ItemSubmissionWithTypeIdentifier[];
  additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
  reporterIdentifier?: ItemIdentifier;
  reportedItems?: ItemIdentifier[];
  reportedForReasons?: Array<{ reporterId?: ItemIdentifier; reason?: string }>;
  reportHistory: ReportHistory;
  enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
};

export type ThreadManualReviewJobPayload = {
  kind: 'DEFAULT';
  item: ItemSubmissionWithTypeIdentifier;
  reportedForReason?: string;
  reporterIdentifier?: ItemIdentifier;
  reportedForReasons?: Array<{ reporterId?: ItemIdentifier; reason?: string }>;
  reportHistory: ReportHistory;
  enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
};

export type NcmecContentItemSubmission = {
  contentItem: ItemSubmissionWithTypeIdentifier;
  isConfirmedCSAM: boolean;
  isReported: boolean;
};

export type NcmecManualReviewJobPayload = {
  kind: 'NCMEC';
  item: ItemSubmissionWithTypeIdentifier; // the user being reviewed
  allMediaItems: NcmecContentItemSubmission[]; // all the user's media from the last 30 days
  userScore?: UserScore;
  enqueueSourceInfo?: ManualReviewJobEnqueueSourceInfo;
  reportHistory: ReportHistory;
};

export type ContentAppealReviewJobPayload = {
  kind: 'APPEAL';
  item: ItemSubmissionWithTypeIdentifier;
  appealId: string;
  userScore?: UserScore;
  additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
  appealerIdentifier?: ItemIdentifier;
  enqueueSourceInfo?: AppealEnqueueSourceInfo;
  appliedRulesIds?: string[];
  actionsTaken?: string[];
  appealReason?: string;
};

export type UserAppealReviewJobPayload = {
  kind: 'APPEAL';
  item: ItemSubmissionWithTypeIdentifier;
  appealId: string;
  userScore?: UserScore;
  additionalContentItems?: ItemSubmissionWithTypeIdentifier[];
  reportedItems?: ItemIdentifier[];
  appealerIdentifier?: ItemIdentifier;
  appealReason?: string;
  enqueueSourceInfo?: AppealEnqueueSourceInfo;
  appliedRulesIds?: string[];
  actionsTaken?: string[];
};

export type ThreadAppealReviewJobPayload = {
  kind: 'APPEAL';
  item: ItemSubmissionWithTypeIdentifier;
  appealId: string;
  appealerIdentifier?: ItemIdentifier;
  enqueueSourceInfo?: AppealEnqueueSourceInfo;
  appliedRulesIds?: string[];
  actionsTaken?: string[];
  appealReason?: string;
};

export type ManualReviewAppealJobPayload =
  | ThreadAppealReviewJobPayload
  | ContentAppealReviewJobPayload
  | UserAppealReviewJobPayload;

export type ManualReviewJobPayload =
  | ContentManualReviewJobPayload
  | UserManualReviewJobPayload
  | ThreadManualReviewJobPayload
  | NcmecManualReviewJobPayload;

export type ManualReviewJobEnqueueSource =
  | 'APPEAL'
  | 'REPORT'
  | 'RULE_EXECUTION'
  | 'MRT_JOB'
  | 'POST_ACTIONS';

export type RuleExecutionEnqueueSourceInfo = {
  kind: 'RULE_EXECUTION';
  rules: string[];
};
export type ReportEnqueueSourceInfo = {
  kind: 'REPORT';
};
export type AppealEnqueueSourceInfo = {
  kind: 'APPEAL';
};
export type MrtJobEnqueueSourceInfo = { kind: 'MRT_JOB' };
export type PostActionsEnqueueSourceInfo = { kind: 'POST_ACTIONS' };

export type ManualReviewJobEnqueueSourceInfo =
  | ReportEnqueueSourceInfo
  | RuleExecutionEnqueueSourceInfo
  | MrtJobEnqueueSourceInfo
  | PostActionsEnqueueSourceInfo;

export type OriginJobInfo = {
  jobId: JobId;
};

export type ManualReviewJobKind = ManualReviewJobPayload['kind'];

export class ManualReviewToolService {
  private readonly queueOps: QueueOperations;
  private readonly jobRendering: JobRendering;
  private readonly jobRouting: JobRouting;
  private readonly appealsJobRouting: AppealsJobRouting;
  private readonly jobEnrichment: JobEnrichment;
  private readonly jobDecisioning: JobDecisioning;
  private readonly decisionAnalytics: DecisionAnalytics;
  private readonly manualReviewToolSettings: ManualReviewToolSettings;
  private readonly commentOps: CommentOperations;
  private readonly skipOps: SkipOperations;

  constructor(
    readonly redis: Dependencies['IORedis'],
    readonly ruleEvaluator: Dependencies['RuleEvaluator'],
    readonly routingRuleExecutionLogger: Dependencies['RoutingRuleExecutionLogger'],
    readonly pgQuery: Kysely<ManualReviewToolServicePg>,
    readonly pgQueryReadReplica: Kysely<ManualReviewToolServicePg>,
    readonly userStatisticsService: UserStatisticsService,
    readonly getCustomActionsByIds: Dependencies['getActionsByIdEventuallyConsistent'],
    private readonly tracer: Dependencies['Tracer'],
    private readonly moderationConfigService: ModerationConfigService,
    readonly partialItemsService: PartialItemsService,
    readonly onRecordDecision: (params: OnRecordDecisionInput) => Promise<void>,
    private readonly onEnqueue: (
      input: ManualReviewJobInput | ManualReviewAppealJobInput,
      queueId: string,
    ) => Promise<void>,
  ) {
    this.queueOps = new QueueOperations(
      pgQuery,
      pgQueryReadReplica,
      moderationConfigService,
      redis,
    );
    this.jobEnrichment = new JobEnrichment(
      partialItemsService,
      userStatisticsService,
    );
    this.jobRouting = new JobRouting(
      pgQuery,
      this.queueOps,
      moderationConfigService,
      ruleEvaluator,
      routingRuleExecutionLogger,
    );
    this.appealsJobRouting = new AppealsJobRouting(
      pgQuery,
      this.queueOps,
      moderationConfigService,
      ruleEvaluator,
      //routingRuleExecutionLogger,
    );
    this.jobDecisioning = new JobDecisioning(
      this.queueOps,
      pgQuery,
      getCustomActionsByIds,
      onRecordDecision,
      moderationConfigService,
      this.tracer,
    );
    this.jobRendering = new JobRendering(pgQuery);
    this.decisionAnalytics = new DecisionAnalytics(pgQueryReadReplica);
    this.manualReviewToolSettings = new ManualReviewToolSettings(pgQuery);
    this.commentOps = new CommentOperations(pgQuery);
    this.skipOps = new SkipOperations(pgQuery);
  }

  /**
   * The payload for enqueue isn't exactly correct - we only accept
   * itemThreadContentItems if the item represents a content type and the items
   * inside them must also be content. Because of how we get the items out of
   * Kysely as individual fields losing their correlation and some limitations
   * of TS,  we check in this function that these are true  and throw if not
   * rather than updating the function signature to be narrower because we would
   * need to tell TS that the input matches what we expect rather than have it
   * check for us which defeats the purpse.
   *
   * If a queueId is provided, it will skip routing and insert into that queue directly.
   */
  async enqueue(input: ManualReviewJobInput, queueId?: string) {
    const MAX_ENQUEUE_ATTEMPTS = 5;

    await this.tracer.addActiveSpan(
      {
        resource: 'mrtService',
        operation: 'enqueue',
        attributes: {
          'mrtJob.enqueueSource': input.enqueueSource,
          'mrtJob.orgId': input.orgId,
          'mrtJob.itemIdentifier': jsonStringify({
            type: input.payload.item.itemTypeIdentifier.id,
            id: input.payload.item.itemId,
          }),
          'mrtJob.submissionId': input.payload.item.submissionId,
        },
      },
      async (span) => {
        let numAttemptsToEnqueue = 0;

        const type = await this.moderationConfigService.getItemType({
          orgId: input.orgId,
          itemTypeSelector: input.payload.item.itemTypeIdentifier,
        });
        if (type === undefined) {
          throw new Error(
            `No item type for org ${input.orgId} with ID ${input.payload.item.itemTypeIdentifier.id}`,
          );
        }
        const enrichedJobPayload = await this.jobEnrichment.enrichJobPayload(
          input,
          type,
        );

        // This function attempts to enqueue an MRT job, after running routing
        // rules on it to get the destination queue. We know that, in the db,
        // foreign key constraints prevent a routing rule from pointing to a
        // non-existent queue. However, it's possible for the destination queue
        // to have been deleted _between the time when the routing rules were
        // loaded from the db and when the attempted enqueue takes place_.
        // Moreover, because the routing rules are cached in memory, the time
        // between them being loaded from the db and the enqueue can actually be
        // relatively long, making this a plausible edge case.
        //
        // In that case, the call to `addJob` or `updateJobForQueue` will throw
        // a queue does not exist error. We know, per the above, that the cause
        // must be that we use ran a stale copy of the rules, so we load the
        // latest routing rules (bypassing the cache with `maxAge: 0`) and retry
        // the enqueue operation until we hit a maximum number of attempts.
        //
        // It's still technically possible for the queue to be deleted between
        // the time we reload the rules and attempt the enqueue, but that should
        // be exceedingly rare, as the time window in that case is much shorter
        // than the amount of time that old rules live in memory due to caching.
        // Even if this did happen, subsequent retries would again reload the
        // rules, and users won't be _repeatedly_ deleting queues right in
        // this brief window while the rules are running.
        const attemptEnqueue = async (): Promise<
          { job: ManualReviewJob; targetQueueForNewJob: string } | undefined
        > => {
          try {
            const targetQueueForNewJob =
              queueId ??
              (await this.jobRouting.getQueueIdForJob({
                orgId: input.orgId,
                payload: enrichedJobPayload,
                correlationId: input.correlationId,
                policyIds: input.policyIds,
                routingRuleCacheDirectives:
                  numAttemptsToEnqueue > 0 ? { maxAge: 0 } : undefined,
              }));

            const existingJobInSameQueue = await this.queueOps.getJobFromItemId(
              {
                orgId: input.orgId,
                itemId: input.payload.item.itemId,
                itemTypeId: input.payload.item.itemTypeIdentifier.id,
                queueId: targetQueueForNewJob,
              },
            );

            const finalJobPayload = existingJobInSameQueue
              ? await this.#mergeJobPayloads(
                  input.orgId,
                  enrichedJobPayload,
                  existingJobInSameQueue.payload,
                )
              : enrichedJobPayload;

            const job = existingJobInSameQueue
              ? await this.queueOps.updateJobForQueue({
                  orgId: input.orgId,
                  queueId: targetQueueForNewJob,
                  jobId: existingJobInSameQueue.id,
                  data: {
                    ...existingJobInSameQueue,
                    payload: finalJobPayload,
                  },
                })
              : await this.queueOps.addJob({
                  orgId: input.orgId,
                  queueId: targetQueueForNewJob,
                  enqueueSourceInfo: input.enqueueSourceInfo,
                  jobPayload: {
                    ...input,
                    payload: finalJobPayload,
                  },
                });

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!job) {
              // this means that we tried to update a job that was deleted
              // between when we looked up the existing job and did the update.
              // Just do nothing
              return;
            }

            // log job creation/enqueue to postgres
            this.pgQuery
              .insertInto('manual_review_tool.job_creations')
              .values({
                id: job.id,
                org_id: job.orgId,
                item_id: job.payload.item.itemId,
                item_type_id: job.payload.item.itemTypeIdentifier.id,
                queue_id: targetQueueForNewJob,
                // We use the Source Info from the input argument to account
                // for the case that we are in fact updating a job which was
                // never inserted into this table and did not have enqueue source
                // info, but the updated job will.
                enqueue_source_info: input.enqueueSourceInfo,
                policy_ids: input.policyIds,
                created_at: new Date(),
              })
              .execute()
              .catch(() => {}); // don't throw if logging fails

            return { targetQueueForNewJob, job };
          } catch (e) {
            if (
              isCoopErrorOfType(e, 'QueueDoesNotExistError') &&
              numAttemptsToEnqueue++ < MAX_ENQUEUE_ATTEMPTS
            ) {
              return attemptEnqueue();
            }

            if (isUniqueViolationError(e)) {
              // This is actually expected behavior, because we'll try to log it when an
              // attempt to enqueue a single item happens more than once in the
              // same queue. Because of that, don't throw an error here and just
              // return undefined, since we don't end up re-enqueuing the item
              // (or anything else).
              span.setStatus({ code: SpanStatusCode.OK });
              return undefined;
            }

            throw e;
          }
        };

        const enqueueResult = await attemptEnqueue();

        // There are some edge cases where enqueue does nothing (see comment
        // above). But, if the enqueue worked, call listeners asynchronously,
        // not caring about whether they fail.
        if (enqueueResult) {
          const { targetQueueForNewJob } = enqueueResult;
          this.onEnqueue(input, targetQueueForNewJob).catch(() => {});
        }
      },
    );
  }

  async enqueueAppeal(input: ManualReviewAppealJobInput, queueId?: string) {
    const MAX_ENQUEUE_ATTEMPTS = 5;

    await this.tracer.addActiveSpan(
      {
        resource: 'mrtService',
        operation: 'enqueueAppeal',
        attributes: {
          'mrtJob.enqueueSource': input.enqueueSource,
          'mrtJob.orgId': input.orgId,
          'mrtJob.itemIdentifier': jsonStringify({
            type: input.payload.item.itemTypeIdentifier.id,
            id: input.payload.item.itemId,
          }),
          'mrtJob.submissionId': input.payload.item.submissionId,
        },
      },
      async (span) => {
        let numAttemptsToEnqueue = 0;

        const type = await this.moderationConfigService.getItemType({
          orgId: input.orgId,
          itemTypeSelector: input.payload.item.itemTypeIdentifier,
        });
        if (type === undefined) {
          throw new Error(
            `No item type for org ${input.orgId} with ID ${input.payload.item.itemTypeIdentifier.id}`,
          );
        }
        const enrichedJobPayload = await this.jobEnrichment.enrichAppealPayload(
          input,
        );

        const attemptAppealEnqueue = async (): Promise<
          | { job: ManualReviewAppealJob; targetQueueForNewJob: string }
          | undefined
        > => {
          try {
            const targetQueueForNewJob =
              queueId ??
              (await this.appealsJobRouting.getQueueIdForJob({
                orgId: input.orgId,
                payload: enrichedJobPayload,
                correlationId: input.correlationId,
                policyIds: input.policyIds,
                routingRuleCacheDirectives:
                  numAttemptsToEnqueue > 0 ? { maxAge: 0 } : undefined,
              }));

            const job = await this.queueOps.addAppealJob({
              orgId: input.orgId,
              queueId: targetQueueForNewJob,
              enqueueSourceInfo: input.enqueueSourceInfo,
              jobPayload: {
                ...input,
                payload: enrichedJobPayload,
              },
            });

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!job) {
              // this means that we tried to update a job that was deleted
              // between when we looked up the existing job and did the update.
              // Just do nothing
              return;
            }

            this.pgQuery
              .insertInto('manual_review_tool.job_creations')
              .values({
                id: job.id,
                org_id: job.orgId,
                item_id: job.payload.item.itemId,
                item_type_id: job.payload.item.itemTypeIdentifier.id,
                queue_id: targetQueueForNewJob,
                enqueue_source_info: input.enqueueSourceInfo,
                policy_ids: input.policyIds,
                created_at: new Date(),
              })
              .execute()
              .catch(() => {}); // don't throw if logging fails

            return { targetQueueForNewJob, job };
          } catch (e) {
            if (
              isCoopErrorOfType(e, 'QueueDoesNotExistError') &&
              numAttemptsToEnqueue++ < MAX_ENQUEUE_ATTEMPTS
            ) {
              return attemptAppealEnqueue();
            }

            if (isUniqueViolationError(e)) {
              // This is actually expected behavior, because we'll try to log it when an
              // attempt to enqueue a single item happens more than once in the
              // same queue. Because of that, don't throw an error here and just
              // return undefined, since we don't end up re-enqueuing the item
              // (or anything else).
              span.setStatus({ code: SpanStatusCode.OK });
              return undefined;
            }

            throw e;
          }
        };

        const enqueueResult = await attemptAppealEnqueue();

        // There are some edge cases where enqueue does nothing (see comment
        // above). But, if the enqueue worked, call listeners asynchronously,
        // not caring about whether they fail.
        if (enqueueResult) {
          const { targetQueueForNewJob } = enqueueResult;
          this.onEnqueue(input, targetQueueForNewJob).catch(() => {});
        }
      },
    );
  }

  async #mergeJobPayloads(
    orgId: string,
    newJob: ManualReviewJobPayload,
    existingJob: ManualReviewJobPayload,
  ): Promise<ManualReviewJobPayload> {
    // we construct the set of reportIds here to make sure this logic is handled
    // independently of any org's settings.
    // Open question as to whether we
    // should enforce that all org-specific merge logic happens strictly after
    // any org-agnostic merge or whether it's fine to overwrite some of the
    // org-specific as we do here.
    const allReportHistories = newJob.reportHistory.concat(
      existingJob.reportHistory,
    );
    const mergedJobPayload = this.#orgSpecificMergeJobs(
      orgId,
      newJob,
      existingJob,
    );
    const finalJobPayload = {
      ...mergedJobPayload,
      reportHistory: Array.from(allReportHistories),
    };
    return finalJobPayload;
  }

  // eslint-disable-next-line complexity
  #orgSpecificMergeJobs(
    _orgId: string, // unused now, but keeping signature for compatibility / configurability
    newJob: ManualReviewJobPayload,
    existingJob: ManualReviewJobPayload,
  ): ManualReviewJobPayload {
    // For NCMEC jobs, always use the latest payload (re-sorted by ncmecEnqueueToMrt)
    if (newJob.kind === 'NCMEC' && existingJob.kind === 'NCMEC') {
      return newJob;
    }

    // For DEFAULT jobs, merge contextual fields
    if (newJob.kind === 'DEFAULT' && existingJob.kind === 'DEFAULT') {
      // Merge itemThreadContentItems (conversation context)
      const mergedThreadItems =
        ('itemThreadContentItems' in newJob || 'itemThreadContentItems' in existingJob)
          ? _.uniqBy(
              [
                ...('itemThreadContentItems' in newJob
                  ? (newJob.itemThreadContentItems ?? [])
                  : []),
                ...('itemThreadContentItems' in existingJob
                  ? (existingJob.itemThreadContentItems ?? [])
                  : []),
              ],
              (it) => jsonStringify([it.itemId, it.itemTypeIdentifier.id]),
            )
          : undefined;

      // Merge reportedItems (list of items reported by users)
      const mergedReportedItems =
        ('reportedItems' in newJob || 'reportedItems' in existingJob)
          ? _.uniqBy(
              [
                ...('reportedItems' in newJob ? (newJob.reportedItems ?? []) : []),
                ...('reportedItems' in existingJob
                  ? (existingJob.reportedItems ?? [])
                  : []),
              ],
              (it) => jsonStringify([it.id, it.typeId]),
            )
          : undefined;

      return {
        ...newJob, // Use new job as base
        ...(mergedThreadItems && mergedThreadItems.length > 0
          ? { itemThreadContentItems: mergedThreadItems }
          : {}),
        ...(mergedReportedItems && mergedReportedItems.length > 0
          ? { reportedItems: mergedReportedItems }
          : {}),
      };
    }

    // For all other cases, use new job
    return newJob;
  }

  /**
   * This method is used to get routing rules for a specific organization.
   * @param orgId - The ID of the organization for which to fetch the routing rules.
   * @returns A promise that resolves to an array of RoutingRule objects.
   */
  async getRoutingRules(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }) {
    return this.jobRouting.getRoutingRules(opts);
  }

  /**
   * This method is used to get appeals routing rules for a specific organization.
   * @param orgId - The ID of the organization for which to fetch the routing rules.
   * @returns A promise that resolves to an array of RoutingRule objects.
   */
  async getAppealsRoutingRules(opts: {
    orgId: string;
    directives?: ConsumerDirectives;
  }) {
    return this.appealsJobRouting.getAppealsRoutingRules(opts);
  }

  /**
   * This method is used to create a new routing rule.
   * @param input - An object containing the necessary parameters to create a new routing rule.
   * @returns A promise that resolves to the newly created RoutingRule object.
   * @throws {RoutingRuleNameExistsError} If the routing rule name already exists.
   * @throws {QueueDoesNotExistError} If the destination queue does not exist.
   */
  async createRoutingRule(
    input: CreateRoutingRuleInput,
  ): Promise<RoutingRuleWithoutVersion> {
    return input.isAppealsRule
      ? this.appealsJobRouting.createAppealsRoutingRule(input)
      : this.jobRouting.createRoutingRule(input);
  }

  /**
   * This method is used to update an existing routing rule.
   * @param input - An object containing the necessary parameters to update a routing rule.
   * @returns A promise that resolves to the updated RoutingRule object.
   * @throws {RoutingRuleNameExistsError} If the new routing rule name already exists.
   * @throws {NotFoundError} If the routing rule to be updated was not found.
   * @throws {QueueDoesNotExistError} If the destination queue does not exist.
   */
  async updateRoutingRule(
    input: UpdateRoutingRuleInput,
  ): Promise<RoutingRuleWithoutVersion> {
    return input.isAppealsRule
      ? this.appealsJobRouting.updateAppealsRoutingRule(input)
      : this.jobRouting.updateRoutingRule(input);
  }

  /**
   * This method is used to delete a routing rule.
   * @param input - An object containing the id of the routing rule to be deleted.
   * @returns A promise that resolves to a boolean indicating the success of the operation.
   */
  async deleteRoutingRule(input: { id: string; isAppealsRule?: boolean }) {
    return input.isAppealsRule
      ? this.appealsJobRouting.deleteAppealsRoutingRule({ id: input.id })
      : this.jobRouting.deleteRoutingRule({ id: input.id });
  }

  async addAccessibleQueuesForUser(
    userId: string,
    queueIds: readonly string[],
  ) {
    return this.queueOps.addAccessibleQueuesForUser([userId], queueIds);
  }

  async removeAccessibleQueuesForUser(
    userId: string,
    queueIds: readonly string[],
  ) {
    return this.queueOps.removeAccessibleQueuesForUser(userId, queueIds);
  }

  /**
   * This method is used to reorder routing rules.
   * Under the hood, it runs a query similar to the following:
   *
   * UPDATE manual_review_tool.routing_rules
   * SET sequence_number =
   *   CASE
   *       WHEN sequence_number = 2 THEN 1
   *       WHEN sequence_number = 1 THEN 2
   *       ELSE sequence_number
   *   END;
   *
   * @param input - An object containing the orgId and the new order of the routing rules.
   * @returns A promise that resolves to an array of reordered RoutingRule objects.
   */
  async reorderRoutingRules(input: ReorderRoutingRulesInput) {
    return input.isAppealsRule
      ? this.appealsJobRouting.reorderAppealsRoutingRules(input)
      : this.jobRouting.reorderRoutingRules(input);
  }

  async createManualReviewQueue(input: {
    name: string;
    description: string | null;
    userIds: readonly string[];
    hiddenActionIds: readonly string[];
    invokedBy: Invoker;
    isAppealsQueue: boolean;
    autoCloseJobs?: boolean;
  }): Promise<ManualReviewQueue> {
    return this.queueOps.createManualReviewQueue(input);
  }

  async updateManualReviewQueue(input: {
    orgId: string;
    queueId: string;
    name?: string;
    description?: string | null;
    userIds: readonly string[];
    actionIdsToHide: readonly string[];
    actionIdsToUnhide: readonly string[];
    autoCloseJobs?: boolean;
  }): Promise<ManualReviewQueue> {
    return this.queueOps.updateManualReviewQueue(input);
  }

  async getDefaultQueueIdForOrg(orgId: string) {
    return this.queueOps.getDefaultQueueIdForOrg(orgId);
  }

  /**
   * This method returns all the queues that are the given user can view
   * and review. Queues are only editable by users with the EditMrtQueues
   * permission.
   */
  async getReviewableQueuesForUser(opts: {
    invoker: Invoker;
  }): Promise<ManualReviewQueue[]> {
    return this.queueOps.getReviewableQueuesForUser(opts);
  }

  async getQueueForOrg(opts: {
    orgId: string;
    userId: string;
    queueId: string;
  }): Promise<ManualReviewQueue | undefined> {
    return this.queueOps.getQueueForOrg(opts);
  }

  async getAllQueuesForOrgAndDangerouslyBypassPermissioning(opts: {
    orgId: string;
  }) {
    return this.queueOps.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
      opts.orgId,
    );
  }

  async getQueueForOrgAndDangerouslyBypassPermissioning(opts: {
    orgId: string;
    queueId: string;
  }) {
    return this.queueOps.getQueueForOrgAndDangerouslyBypassPermissioning(opts);
  }

  async getFavoriteQueuesForUser(opts: { orgId: string; userId: string }) {
    return this.queueOps.getFavoriteQueuesForUser(opts);
  }

  async addFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    return this.queueOps.addFavoriteQueueForUser(opts);
  }

  async removeFavoriteQueueForUser(opts: {
    userId: string;
    orgId: string;
    queueId: string;
  }) {
    return this.queueOps.removeFavoriteQueueForUser(opts);
  }

  /**
   * @returns true when the queue that was trying to be deleted
   * exists and is successfully deleted, false when the queue
   * did not exist and throws when the delete fails for some reason.
   * In case of failure, some jobs may still have been deleted.
   */
  async deleteManualReviewQueue(orgId: string, queueId: string) {
    return this.queueOps.deleteManualReviewQueue(orgId, queueId);
  }

  async deleteManualReviewQueueForTestsDO_NOT_USE(
    orgId: string,
    queueId: string,
  ) {
    return this.queueOps.deleteManualReviewQueueForTestsDO_NOT_USE(
      orgId,
      queueId,
    );
  }

  async getJobsForQueue(opts: {
    orgId: string;
    queueId: string;
    jobIds: readonly string[];
    isAppealsQueue?: boolean;
  }) {
    const { orgId, queueId, jobIds, isAppealsQueue = false } = opts;
    return isAppealsQueue
      ? this.queueOps.getAppealJobs({
          orgId,
          queueId,
          jobIds: jobIds satisfies readonly string[] as readonly JobId[],
        })
      : this.queueOps.getJobs({
          orgId,
          queueId,
          jobIds: jobIds satisfies readonly string[] as readonly JobId[],
        });
  }

  async getAllJobsForQueue(opts: { orgId: string; queueId: string }) {
    return this.queueOps.getAllJobsForQueue(opts);
  }

  async getPendingJobCount(opts: { orgId: string; queueId: string }) {
    return this.queueOps.getPendingJobCount(opts);
  }

  async getOldestJobCreatedAt(opts: {
    orgId: string;
    queueId: string;
    isAppealsQueue: boolean;
  }) {
    return this.queueOps.getOldestJobCreatedAt(opts);
  }

  async getHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
  }) {
    return this.jobRendering.getHiddenFieldsForItemType(opts);
  }

  async getIgnoreCallbackForOrg(orgId: string) {
    return this.jobDecisioning.getIgnoreCallbackForOrg(orgId);
  }

  async setHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    hiddenFields: readonly string[];
  }) {
    return this.jobRendering.setHiddenFieldsForItemType(opts);
  }

  async getUsersWhoCanSeeQueue(opts: {
    queueId: string;
    userId: string;
    orgId: string;
  }) {
    const { orgId, queueId } = opts;

    return this.queueOps.getUsersWhoCanSeeQueue({ orgId, queueId });
  }

  async getDecisionTimeToAction(input: TimeToActionInput) {
    return this.decisionAnalytics.getTimeToAction(input);
  }

  async getDecisionCounts(input: DecisionCountsInput) {
    return this.decisionAnalytics.getDecisionCounts(input);
  }

  async getJobCreationCounts(input: JobCreationsInput) {
    return this.decisionAnalytics.getJobCreations(input);
  }

  async getResolvedJobCounts(input: JobCountsInput) {
    return this.decisionAnalytics.getResolvedJobCounts(input);
  }

  async getSkippedJobCounts(input: SkippedJobCountInput) {
    return this.skipOps.getSkippedJobCount(input);
  }

  async getDecisionCountsTable(input: DecisionCountsTableInput) {
    return this.decisionAnalytics.getDecisionCountsTable(input);
  }

  async getRecentDecisions(opts: {
    userPermissions: UserPermission[];
    orgId: string;
    input: RecentDecisionsFilterInput;
  }) {
    return this.decisionAnalytics.getRecentDecisions(opts);
  }

  async getSkippedJobsForRecentDecisions(opts: {
    orgId: string;
    input: Omit<RecentDecisionsFilterInput, 'page' | 'startTime' | 'endTime'>;
  }) {
    return this.skipOps.getSkippedJobsForRecentDecisions(opts);
  }

  async getExistingJobsForItem(opts: {
    orgId: string;
    itemId: string;
    itemTypeId: string;
  }) {
    return this.queueOps.getExistingJobsForItem(opts);
  }

  async getDecidedJob(opts: { orgId: string; id: string }) {
    return this.decisionAnalytics.getDecidedJob(opts);
  }

  async getDecidedJobFromJobId(opts: {
    orgId: string;
    jobId: string;
    userPermissions: UserPermission[];
  }) {
    return this.decisionAnalytics.getDecidedJobFromJobId(opts);
  }

  async dequeueNextJob(opts: {
    orgId: string;
    queueId: string;
    userId: string;
  }) {
    const { orgId, queueId, userId } = opts;
    const queue =
      await this.queueOps.getQueueForOrgAndDangerouslyBypassPermissioning({
        orgId,
        queueId,
      });

    let shouldBeAutoActioned = queue?.autoCloseJobs ?? false;
    let job = await this.queueOps.dequeueNextJobWithLock({
      orgId,
      queueId,
      lockToken: userId,
    });
    if (!shouldBeAutoActioned || !job) {
      return job;
    }

    // Some orgs have configured queues to auto-delete jobs in which
    // the reported item has already been deleted in their system.
    // in this loop we check the partialItems endpoint provided by the org,
    // as well as the queue settings, to auto-action these jobs and return
    // the first job with a reported item that has not been deleted.
    while (shouldBeAutoActioned) {
      const freshItemInfo = await this.partialItemsService
        .getPartialItem(orgId, {
          id: job.job.payload.item.itemId,
          typeId: job.job.payload.item.itemTypeIdentifier.id,
        })
        .catch(() => null);
      if (!freshItemInfo) {
        return job;
      }

      const isDeletedFieldRole =
        getFieldValueForRole(
          freshItemInfo.itemType.schema,
          freshItemInfo.itemType.schemaFieldRoles,
          'isDeleted',
          freshItemInfo.data,
        ) ?? false;

      // TODO: This is a temporary solution to get the deleted field value
      // from legacy items that have not been migrated to the new schema.
      // Remove after ~48 hours.
      const deletedFieldValue =
        getFieldValueOrValues<'BOOLEAN'>(freshItemInfo.data, {
          type: 'BOOLEAN',
          name: 'deleted',
          required: false,
          container: null,
        })?.value ?? false;

      // If a queue has auto-actioning enabled, and the reported item has been
      // deleted, we should auto-close the job and move on to the next one.
      shouldBeAutoActioned = deletedFieldValue || isDeletedFieldRole;
      if (!shouldBeAutoActioned) {
        return job;
      } else {
        await this.submitDecision({
          queueId,
          reportHistory: job.job.payload.reportHistory,
          jobId: job.job.id,
          lockToken: job.lockToken,
          automaticCloseDecision: {
            type: 'AUTOMATIC_CLOSE',
            reason: 'ITEM_DELETED_BEFORE_REVIEW',
          },
          relatedActions: [],
          orgId,
        });

        job = await this.queueOps.dequeueNextJobWithLock({
          orgId,
          queueId,
          lockToken: userId,
        });

        if (!job) {
          return job;
        }
      }
    }
    return null;
  }

  async deleteAllJobsFromQueue(opts: {
    orgId: string;
    queueId: string;
    userPermissions: readonly UserPermission[];
  }) {
    return this.queueOps.deleteAllJobsFromQueue(opts);
  }

  async submitDecision(
    opts: OmitEach<SubmitDecisionInput, 'jobId'> & { jobId: string },
  ) {
    // As submitDecision is a public method, we assume the passed in jobId is an
    // external id (which are the only kind that should leave the mrt service).
    return this.jobDecisioning.submitDecision(opts as SubmitDecisionInput);
  }

  async getNcmecDecisions(opts: { startDate: Date; endDate: Date }) {
    return this.jobDecisioning.getNcmecDecisions(opts);
  }

  async upsertDefaultSettings(opts: { orgId: string }) {
    return this.manualReviewToolSettings.upsertDefaultSettings(opts);
  }

  async getRequiresPolicyForDecisions(orgId: string) {
    return this.manualReviewToolSettings.getRequiresPolicyForDecisions(orgId);
  }

  async getHideSkipButtonForNonAdmins(orgId: string) {
    return this.manualReviewToolSettings.getHideSkipButtonForNonAdmins(orgId);
  }

  async getRequiresDecisionReason(orgId: string) {
    return this.manualReviewToolSettings.getRequiresDecisionReason(orgId);
  }

  async getPreviewJobsViewEnabled(orgId: string) {
    return this.manualReviewToolSettings.getPreviewJobsViewEnabled(orgId);
  }

  async getJobComments(opts: { orgId: string; jobId: string }) {
    return this.commentOps.getComments(opts);
  }

  async getJobCommentCount(opts: { orgId: string; jobId: string }) {
    return this.commentOps.getCommentCount(opts);
  }

  async addJobComment(opts: {
    orgId: string;
    jobId: string;
    commentText: string;
    authorId: string;
  }) {
    return this.commentOps.addComment(opts);
  }

  async deleteJobComment(opts: {
    orgId: string;
    jobId: string;
    userId: string;
    commentId: string;
  }) {
    return this.commentOps.deleteComment(opts);
  }

  async getHiddenActionsForQueue(opts: { orgId: string; queueId: string }) {
    return this.queueOps.getHiddenActionsForQueue(opts);
  }

  async updateHiddenActionsForQueue(opts: {
    orgId: string;
    actionIdsToHide: string[];
    actionIdsToUnhide: string[];
    queueId: string;
  }) {
    return this.queueOps.updateHiddenActionsForQueue(opts);
  }

  async logSkip(opts: {
    orgId: string;
    queueId: string;
    jobId: string;
    userId: string;
  }) {
    await this.skipOps.logSkip(opts);
  }

  async releaseJobLock(opts: {
    orgId: string;
    queueId: string;
    jobId: string;
    lockToken: string;
  }) {
    // As releaseJobLock is a public method, we assume the passed in jobId is an
    // external id (which are the only kind that should leave the mrt service).
    await this.queueOps.releaseJobLock(opts as {
      orgId: string;
      queueId: string;
      jobId: JobId;
      lockToken: string;
    });
  }

  async close() {
    return Promise.all([this.queueOps.close(), this.jobRouting.close()]);
  }
}
