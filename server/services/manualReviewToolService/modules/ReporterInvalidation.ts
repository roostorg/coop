import { type ItemIdentifier } from '@roostorg/types';

import { type Dependencies } from '../../../iocContainer/index.js';
import { jsonStringify } from '../../../utils/encoding.js';
import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import { type Invoker } from '../../userManagementService/index.js';
import {
  type JobId,
  type ManualReviewJob,
  type ManualReviewJobPayload,
  type ReportHistory,
} from '../manualReviewToolService.js';
import type QueueOperations from './QueueOperations.js';

export type InvalidateReportsFromReporterInput = {
  orgId: string;
  reporter: ItemIdentifier;
  invokedBy: Invoker;
  reason?: string;
  // When set, scope the sweep to this single MRT job instead of the org.
  jobId?: string;
  // Per-queue scan caps; overridable for tests and ops.
  batchSize?: number;
  maxJobsPerQueue?: number;
};

export type InvalidateReportsFromReporterResult = {
  queuesScanned: number;
  jobsScanned: number;
  jobsScrubbed: number;
  jobsDeleted: number;
  reportsRemoved: number;
  // True when a queue exceeded the per-queue scan cap, so the sweep was partial.
  truncated: boolean;
};

// Keep a single sweep bounded even for a reporter with a huge item set.
const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_MAX_JOBS_PER_QUEUE = 10_000;

// Org-wide sweeps currently running, keyed by (org, reporter). Guards
// against a reviewer queueing many concurrent sweeps. Process-local, so
// the cap is per pod rather than global.
const IN_FLIGHT_SWEEPS = new Set<string>();

function inFlightKey(orgId: string, reporter: ItemIdentifier): string {
  return `${orgId}\u241F${reporter.typeId}\u241F${reporter.id}`;
}

class SweepAlreadyInFlightError extends Error {
  readonly code = 'SWEEP_IN_FLIGHT';
  constructor() {
    super('A reporter invalidation sweep is already running for this user.');
    this.name = 'SweepAlreadyInFlightError';
  }
}

export { SweepAlreadyInFlightError };

/**
 * "Invalidate reports from a reporter" (#404). Walks every pending MRT job
 * for the org, removes that reporter's entries from `reportHistory` and
 * `reportedForReasons`, and deletes jobs whose history empties out *and*
 * which were enqueued purely by a report (kind === 'REPORT'); rule/
 * post-action enqueues are preserved.
 */
export default class ReporterInvalidation {
  constructor(
    private readonly queueOps: QueueOperations,
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  async invalidateReportsFromReporter(
    input: InvalidateReportsFromReporterInput,
  ): Promise<InvalidateReportsFromReporterResult> {
    const { orgId, reporter, invokedBy, jobId, reason } = input;

    return this.tracer.addActiveSpan(
      {
        resource: 'mrtService',
        operation: 'invalidateReportsFromReporter',
        attributes: {
          'reporterInvalidation.orgId': orgId,
          // Encoded so PII-shaped ids don't end up as raw free strings in
          // trace UIs.
          'reporterInvalidation.reporter': jsonStringify({
            typeId: reporter.typeId,
            id: reporter.id,
          }),
          'reporterInvalidation.invokedByUserId': invokedBy.userId,
          'reporterInvalidation.scope': jobId ? 'single_job' : 'org_wide',
          ...(reason == null ? {} : { 'reporterInvalidation.reason': reason }),
        },
      },
      async (span) => {
        const result: InvalidateReportsFromReporterResult = {
          queuesScanned: 0,
          jobsScanned: 0,
          jobsScrubbed: 0,
          jobsDeleted: 0,
          reportsRemoved: 0,
          truncated: false,
        };

        // Only guard the org-wide path; single-job sweeps are cheap.
        const sweepKey = jobId == null ? inFlightKey(orgId, reporter) : null;
        if (sweepKey != null) {
          if (IN_FLIGHT_SWEEPS.has(sweepKey)) {
            throw new SweepAlreadyInFlightError();
          }
          IN_FLIGHT_SWEEPS.add(sweepKey);
        }

        try {
          if (jobId != null) {
            const located = await this.queueOps.findPendingJobByJobId({
              orgId,
              jobId: instantiateOpaqueType<JobId>(jobId),
            });
            result.queuesScanned = located ? 1 : 0;
            if (located) {
              result.jobsScanned = 1;
              const perJob = await this.#applyScrubToJob({
                orgId,
                queueId: located.queueId,
                job: located.job,
                reporter,
                invokerUserId: invokedBy.userId,
              });
              result.jobsScrubbed += perJob.jobsScrubbed;
              result.jobsDeleted += perJob.jobsDeleted;
              result.reportsRemoved += perJob.reportsRemoved;
            }
          } else {
            const queues =
              await this.queueOps.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
                orgId,
              );
            result.queuesScanned = queues.length;

            // Appeals queues don't carry user-submitted reportHistory.
            const nonAppealQueues = queues.filter((q) => !q.isAppealsQueue);

            for (const queue of nonAppealQueues) {
              const perQueue = await this.#scrubQueueForReporter({
                orgId,
                queueId: queue.id,
                reporter,
                invokerUserId: invokedBy.userId,
                batchSize: input.batchSize ?? DEFAULT_BATCH_SIZE,
                maxJobsPerQueue:
                  input.maxJobsPerQueue ?? DEFAULT_MAX_JOBS_PER_QUEUE,
              });

              result.jobsScanned += perQueue.jobsScanned;
              result.jobsScrubbed += perQueue.jobsScrubbed;
              result.jobsDeleted += perQueue.jobsDeleted;
              result.reportsRemoved += perQueue.reportsRemoved;
              result.truncated ||= perQueue.truncated;
            }
          }
        } finally {
          if (sweepKey != null) {
            IN_FLIGHT_SWEEPS.delete(sweepKey);
          }
        }

        span.setAttributes({
          'reporterInvalidation.jobsScanned': result.jobsScanned,
          'reporterInvalidation.jobsScrubbed': result.jobsScrubbed,
          'reporterInvalidation.jobsDeleted': result.jobsDeleted,
          'reporterInvalidation.reportsRemoved': result.reportsRemoved,
          'reporterInvalidation.truncated': result.truncated,
        });

        return result;
      },
    );
  }

  async #scrubQueueForReporter(opts: {
    orgId: string;
    queueId: string;
    reporter: ItemIdentifier;
    invokerUserId: string;
    batchSize: number;
    maxJobsPerQueue: number;
  }): Promise<{
    jobsScanned: number;
    jobsScrubbed: number;
    jobsDeleted: number;
    reportsRemoved: number;
    truncated: boolean;
  }> {
    const {
      orgId,
      queueId,
      reporter,
      invokerUserId,
      batchSize,
      maxJobsPerQueue,
    } = opts;

    let jobsScanned = 0;
    let jobsScrubbed = 0;
    let jobsDeleted = 0;
    let reportsRemoved = 0;
    const progress = { truncated: false };

    for await (const job of this.queueOps.iteratePendingJobsForQueue({
      orgId,
      queueId,
      batchSize,
      maxJobs: maxJobsPerQueue,
      progress,
    })) {
      jobsScanned++;
      const perJob = await this.#applyScrubToJob({
        orgId,
        queueId,
        job,
        reporter,
        invokerUserId,
      });
      jobsScrubbed += perJob.jobsScrubbed;
      jobsDeleted += perJob.jobsDeleted;
      reportsRemoved += perJob.reportsRemoved;
    }

    return {
      jobsScanned,
      jobsScrubbed,
      jobsDeleted,
      reportsRemoved,
      truncated: progress.truncated,
    };
  }

  async #applyScrubToJob(opts: {
    orgId: string;
    queueId: string;
    job: ManualReviewJob;
    reporter: ItemIdentifier;
    invokerUserId: string;
  }): Promise<{
    jobsScrubbed: number;
    jobsDeleted: number;
    reportsRemoved: number;
  }> {
    const { orgId, queueId, job, reporter, invokerUserId } = opts;

    const scrub = scrubPayloadForReporter(job.payload, reporter);
    if (scrub.removedCount === 0) {
      return { jobsScrubbed: 0, jobsDeleted: 0, reportsRemoved: 0 };
    }

    // Delete only when the job was enqueued purely by a report and its
    // history is now empty. `removeJobAllowingInvokerLock` removes the job
    // when the invoker holds the lock (or it's unlocked) and scrubs in
    // place otherwise, so another reviewer's lock is never stolen.
    if (
      scrub.payload.reportHistory.length === 0 &&
      job.enqueueSourceInfo?.kind === 'REPORT'
    ) {
      const removed = await this.queueOps.removeJobAllowingInvokerLock({
        orgId,
        queueId,
        jobId: job.id,
        invokerUserId,
      });
      if (removed) {
        return {
          jobsScrubbed: 0,
          jobsDeleted: 1,
          reportsRemoved: scrub.removedCount,
        };
      }
    }

    const updated = await this.queueOps.updateJobForQueue({
      orgId,
      queueId,
      jobId: job.id,
      data: { ...job, payload: scrub.payload },
    });
    // undefined means the slot now holds a different job; treat as no-op.
    if (updated == null) {
      return { jobsScrubbed: 0, jobsDeleted: 0, reportsRemoved: 0 };
    }
    return {
      jobsScrubbed: 1,
      jobsDeleted: 0,
      reportsRemoved: scrub.removedCount,
    };
  }
}

/**
 * Returns a new payload with the given reporter's entries stripped from
 * `reportHistory` and (for DEFAULT-kind payloads) `reportedForReasons`.
 * Pure; exported for unit testing.
 */
export function scrubPayloadForReporter(
  payload: ManualReviewJobPayload,
  reporter: ItemIdentifier,
): { payload: ManualReviewJobPayload; removedCount: number } {
  const isMatch = (rid: ItemIdentifier | undefined): boolean =>
    rid != null && rid.typeId === reporter.typeId && rid.id === reporter.id;

  const filteredHistory: ReportHistory = payload.reportHistory.filter(
    (entry) => !isMatch(entry.reporterId),
  );
  const historyRemovedCount =
    payload.reportHistory.length - filteredHistory.length;

  // Legacy jobs can have an empty `reportHistory` with the reporter still in
  // `reportedForReasons`, so check both rather than early-returning on history.
  if (payload.kind === 'DEFAULT' && 'reportedForReasons' in payload) {
    const existingReasons = payload.reportedForReasons ?? [];
    const filteredReasons = existingReasons.filter(
      (entry) => !isMatch(entry.reporterId),
    );
    const reasonsRemovedCount = existingReasons.length - filteredReasons.length;

    if (historyRemovedCount === 0 && reasonsRemovedCount === 0) {
      return { payload, removedCount: 0 };
    }

    // The MRT UI hides `reportHistory[0]` from the "other reports" table,
    // assuming it's represented in `reportedForReasons`. If filtering
    // empties `reportedForReasons` while history remains, repoint it at
    // the new newest entry so that report stays visible.
    const reportedForReasons =
      filteredReasons.length === 0 && filteredHistory.length > 0
        ? [
            {
              reporterId: filteredHistory[0].reporterId,
              reason: filteredHistory[0].reason,
            },
          ]
        : filteredReasons;

    // Keep legacy singular fields in sync when they named the scrubbed reporter.
    const legacyReporterMatches = isMatch(payload.reporterIdentifier);

    return {
      payload: {
        ...payload,
        reportHistory: filteredHistory,
        reportedForReasons,
        ...(legacyReporterMatches && 'reporterIdentifier' in payload
          ? { reporterIdentifier: filteredHistory[0]?.reporterId }
          : {}),
        ...(legacyReporterMatches && 'reportedForReason' in payload
          ? { reportedForReason: filteredHistory[0]?.reason }
          : {}),
      },
      // Fall back to the reasons count for legacy jobs with no history.
      removedCount: historyRemovedCount || reasonsRemovedCount,
    };
  }

  // NCMEC and other non-DEFAULT payloads only have `reportHistory`.
  if (historyRemovedCount === 0) {
    return { payload, removedCount: 0 };
  }
  return {
    payload: { ...payload, reportHistory: filteredHistory },
    removedCount: historyRemovedCount,
  };
}
