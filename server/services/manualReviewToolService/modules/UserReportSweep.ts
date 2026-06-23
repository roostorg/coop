import { type ItemIdentifier } from '@roostorg/types';

import { type Dependencies } from '../../../iocContainer/index.js';
import { jsonStringify } from '../../../utils/encoding.js';
import { getFieldValueForRole } from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  type ClearReportsDisposition,
  type ClearReportsScope,
} from '../dbTypes.js';
import { type ManualReviewJob } from '../manualReviewToolService.js';
import type JobDecisioning from './JobDecisioning.js';
import { type CustomActionDecisionComponent } from './JobDecisioning.js';
import type QueueOperations from './QueueOperations.js';

export type ClearOtherReportsInput = {
  orgId: string;
  // The job the moderator just took an action on; excluded from the sweep.
  actionedJob: ManualReviewJob;
  actionedQueueId: string;
  disposition: ClearReportsDisposition;
  scope: ClearReportsScope;
  // The custom action(s) the moderator took; re-applied to other jobs when the
  // disposition is SAME_ACTION.
  triggerCustomActions: readonly CustomActionDecisionComponent[];
  reviewerId: string;
  reviewerEmail: string;
  decisionReason?: string;
  // Per-queue scan caps; overridable for tests and ops.
  batchSize?: number;
  maxJobsPerQueue?: number;
};

export type ClearOtherReportsResult = {
  subjectUser: ItemIdentifier | undefined;
  queuesScanned: number;
  jobsScanned: number;
  jobsDisposed: number;
  // True when a queue hit the per-queue scan cap, so the sweep was partial.
  truncated: boolean;
};

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_JOBS_PER_QUEUE = 10_000;

// In-flight sweeps keyed by (org, user), to coalesce a burst of actions on the
// same user. Process-local, so the cap is per pod.
const IN_FLIGHT_SWEEPS = new Set<string>();

function inFlightKey(orgId: string, user: ItemIdentifier): string {
  return `${orgId}\u241F${user.typeId}\u241F${user.id}`;
}

/**
 * "Clear all other reports for a user" (issue #650): after a configured trigger
 * action, dispose of every other pending job for the same user. A job's user is
 * the reported USER item or a reported CONTENT item's creator. NCMEC (CSAM) jobs
 * are never swept.
 */
export default class UserReportSweep {
  constructor(
    private readonly queueOps: QueueOperations,
    private readonly jobDecisioning: JobDecisioning,
    private readonly moderationConfigService: Dependencies['ModerationConfigService'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  async clearOtherReportsForUser(
    input: ClearOtherReportsInput,
  ): Promise<ClearOtherReportsResult> {
    const { orgId, actionedJob, actionedQueueId, scope } = input;

    return this.tracer.addActiveSpan(
      {
        resource: 'mrtService',
        operation: 'clearOtherReportsForUser',
        attributes: {
          'clearOtherReports.orgId': orgId,
          'clearOtherReports.disposition': input.disposition,
          'clearOtherReports.scope': scope,
        },
      },
      async (span) => {
        const result: ClearOtherReportsResult = {
          subjectUser: undefined,
          queuesScanned: 0,
          jobsScanned: 0,
          jobsDisposed: 0,
          truncated: false,
        };

        const subjectUser = await this.#resolveSubjectUser(
          orgId,
          actionedJob.payload.item,
        );
        result.subjectUser = subjectUser;
        if (subjectUser == null) {
          // No resolvable user (e.g. a thread report) — nothing to sweep.
          return result;
        }

        const sweepKey = inFlightKey(orgId, subjectUser);
        if (IN_FLIGHT_SWEEPS.has(sweepKey)) {
          return result;
        }
        IN_FLIGHT_SWEEPS.add(sweepKey);

        try {
          const queueIds = await this.#queueIdsForScope({
            orgId,
            scope,
            originQueueId: actionedQueueId,
          });
          result.queuesScanned = queueIds.length;

          for (const queueId of queueIds) {
            const perQueue = await this.#sweepQueue({
              queueId,
              subjectUser,
              input,
            });
            result.jobsScanned += perQueue.jobsScanned;
            result.jobsDisposed += perQueue.jobsDisposed;
            result.truncated ||= perQueue.truncated;
          }
        } finally {
          IN_FLIGHT_SWEEPS.delete(sweepKey);
        }

        span.setAttributes({
          'clearOtherReports.subjectUser': jsonStringify({
            typeId: subjectUser.typeId,
            id: subjectUser.id,
          }),
          'clearOtherReports.jobsScanned': result.jobsScanned,
          'clearOtherReports.jobsDisposed': result.jobsDisposed,
          'clearOtherReports.truncated': result.truncated,
        });

        return result;
      },
    );
  }

  async #queueIdsForScope(opts: {
    orgId: string;
    scope: ClearReportsScope;
    originQueueId: string;
  }): Promise<string[]> {
    const { orgId, scope, originQueueId } = opts;
    if (scope === 'CURRENT_QUEUE') {
      return [originQueueId];
    }
    const queues =
      await this.queueOps.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
        orgId,
      );
    // Appeals queues hold appeal jobs, not user reports, so never sweep them.
    return queues.filter((q) => !q.isAppealsQueue).map((q) => q.id);
  }

  async #sweepQueue(opts: {
    queueId: string;
    subjectUser: ItemIdentifier;
    input: ClearOtherReportsInput;
  }): Promise<{
    jobsScanned: number;
    jobsDisposed: number;
    truncated: boolean;
  }> {
    const { queueId, subjectUser, input } = opts;
    const { orgId, actionedJob } = input;

    let jobsScanned = 0;
    let jobsDisposed = 0;
    const progress = { truncated: false };

    for await (const job of this.queueOps.iteratePendingJobsForQueue({
      orgId,
      queueId,
      batchSize: input.batchSize ?? DEFAULT_BATCH_SIZE,
      maxJobs: input.maxJobsPerQueue ?? DEFAULT_MAX_JOBS_PER_QUEUE,
      progress,
    })) {
      jobsScanned++;

      // Never act on the job the moderator just decided.
      if (job.id === actionedJob.id) {
        continue;
      }
      // CSAM caveat: NCMEC jobs are never swept.
      if (job.payload.kind === 'NCMEC') {
        continue;
      }

      try {
        const jobUser = await this.#resolveSubjectUser(orgId, job.payload.item);
        if (
          jobUser == null ||
          jobUser.id !== subjectUser.id ||
          jobUser.typeId !== subjectUser.typeId
        ) {
          continue;
        }

        const disposed = await this.#disposeJob({ queueId, job, input });
        if (disposed) {
          jobsDisposed++;
        }
      } catch (error) {
        // A single job failure must not abort the entire sweep. Log the error
        // for observability but continue processing remaining jobs.
        this.tracer.addSpan(
          {
            resource: 'mrtService',
            operation: 'clearOtherReports.disposeJob',
          },
          (span) => {
            span.setAttribute('job.id', job.id);
            span.setAttribute('queue.id', queueId);
            this.tracer.logSpanFailed(span, error);
            return null;
          },
        );
      }
    }

    return { jobsScanned, jobsDisposed, truncated: progress.truncated };
  }

  async #disposeJob(opts: {
    queueId: string;
    job: ManualReviewJob;
    input: ClearOtherReportsInput;
  }): Promise<boolean> {
    const { queueId, job, input } = opts;
    const { orgId, reviewerId } = input;

    // Record the decision before removing the job, a job must never leave
    // the queue without its decision, so it is durably logged first, or it
    // could be lost if the recording step fails.
    const outcome = await this.jobDecisioning.recordSweptJobDisposition({
      orgId,
      queueId,
      job,
      disposition: input.disposition,
      triggerCustomActions: input.triggerCustomActions,
      reviewerId,
      reviewerEmail: input.reviewerEmail,
      decisionReason: input.decisionReason,
    });
    if (outcome === 'skipped') {
      return false;
    }

    // Best-effort removal. If it fails (e.g. another reviewer holds the lock),
    // the job now has a decision and is dropped the next time it's dequeued.
    await this.queueOps.removeJobAllowingInvokerLock({
      orgId,
      queueId,
      jobId: job.id,
      invokerUserId: reviewerId,
    });

    return outcome === 'logged';
  }

  /**
   * The user a job concerns: a reported USER item is itself the user; a
   * reported CONTENT item's user is its creator. THREAD and other kinds have no
   * single subject user, so they're never swept.
   */
  async #resolveSubjectUser(
    orgId: string,
    item: ItemSubmissionWithTypeIdentifier,
  ): Promise<ItemIdentifier | undefined> {
    const itemType = await this.moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: item.itemTypeIdentifier,
    });
    if (!itemType) {
      return undefined;
    }
    if (itemType.kind === 'USER') {
      return { id: item.itemId, typeId: item.itemTypeIdentifier.id };
    }
    if (itemType.kind === 'CONTENT') {
      if (item.creator?.id != null && item.creator.id !== '') {
        return item.creator;
      }
      const fromData = getFieldValueForRole(
        itemType.schema,
        itemType.schemaFieldRoles,
        'creatorId',
        item.data,
      );
      return fromData?.id != null && fromData.id !== '' ? fromData : undefined;
    }
    return undefined;
  }
}
