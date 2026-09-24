import type QueueOperations from './manualReviewToolService/modules/QueueOperations.js';
import type { QueueSnapshot } from './manualReviewToolService/utils/ReviewQueueSnapshot.js';

export type ReadReviewQueueSnapshots = (
  orgId: string,
  signal: AbortSignal,
) => Promise<{ queueId: string; snapshot: QueueSnapshot }[]>;
export type ReviewMetricsCollector = (
  read: ReadReviewQueueSnapshots,
) => () => void;
export class ReviewMetricsQueueLimitError extends Error {}

// Register before service construction. Scheduling and exporters belong to the deployment.
let collectors: { start: ReviewMetricsCollector }[] = [];
export function registerReviewMetricsCollector(start: ReviewMetricsCollector) {
  const entry = { start };
  collectors = [...collectors, entry];
  return () => {
    collectors = collectors.filter((it) => it !== entry);
  };
}

export function startReviewMetricsCollector(
  queues: Pick<
    QueueOperations,
    'getAllQueuesForOrgAndDangerouslyBypassPermissioning' | 'getMetricsSnapshot'
  >,
) {
  const collector = collectors.at(-1);
  if (!collector) return undefined;
  try {
    const stop = collector.start(async (orgId, signal) => {
      if (!orgId) throw new Error('Review snapshot scope is required');
      signal.throwIfAborted();
      const list =
        await queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning(
          orgId,
          51,
        );
      signal.throwIfAborted();
      if (list.length > 50)
        throw new ReviewMetricsQueueLimitError(
          'Review snapshot queue limit exceeded',
        );
      const results = [];
      for (const queue of list) {
        signal.throwIfAborted();
        results.push({
          queueId: queue.id,
          snapshot: await queues.getMetricsSnapshot(
            { orgId, queueId: queue.id, isAppealsQueue: queue.isAppealsQueue },
            signal,
          ),
        });
      }
      signal.throwIfAborted();
      return results;
    });
    return () => {
      try {
        stop();
      } catch {
        /* Optional telemetry must not break shutdown. */
      }
    };
  } catch {
    return undefined; // Optional telemetry must not prevent reviews from starting.
  }
}
