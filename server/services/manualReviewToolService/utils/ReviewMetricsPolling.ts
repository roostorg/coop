import { type ManualReviewMetrics } from './ManualReviewMetrics.js';
import {
  reviewQueueStates,
  type QueueSnapshot,
} from './ReviewQueueSnapshot.js';

export class ReviewMetricsQueueLimitError extends Error {}

// A timeout invalidates the result; shared client calls must settle before another poll.
export function startReviewMetricsPolling(
  metrics: ManualReviewMetrics,
  read: (
    signal: AbortSignal,
  ) => Promise<{ queueId: string; snapshot: QueueSnapshot }[]>,
  intervalMs = 60_000,
  timeoutMs = 20_000,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let previousQueues = new Set<string>();
  const attributes = { queue_id: 'all' };
  const poll = async () => {
    if (stopped) return;
    controller = new AbortController();
    const signal = controller.signal;
    const expiresAt = Date.now() + timeoutMs;
    let failed = false;
    const fail = (reason: 'timeout' | 'queue_limit' | 'read') => {
      if (stopped || failed) return;
      failed = true;
      metrics.gauge('success', 0, attributes);
      metrics.event(`collection_failed_${reason}`, attributes);
    };
    metrics.gauge('attempt_timestamp', Date.now() / 1000, attributes);
    deadline = setTimeout(() => {
      controller?.abort();
      fail('timeout');
    }, timeoutMs);
    deadline.unref();
    try {
      const results = await read(signal);
      if (stopped) return;
      if (signal.aborted || Date.now() >= expiresAt) {
        controller.abort();
        fail('timeout');
        return;
      }
      const currentQueues = new Set(results.map(({ queueId }) => queueId));
      for (const queueId of previousQueues) {
        if (currentQueues.has(queueId)) continue;
        const tags = { queue_id: queueId };
        for (const state of reviewQueueStates)
          metrics.gauge('jobs', 0, { ...tags, state });
        metrics.gauge('oldest_observed_age_seconds', 0, tags);
        metrics.gauge('coverage', 1, tags);
        metrics.gauge('sample_timestamp', Date.now() / 1000, tags);
        metrics.gauge('present', 0, tags);
        metrics.event('queue_removed', tags);
      }
      for (const { queueId, snapshot } of results) {
        const tags = { queue_id: queueId };
        for (const [state, count] of Object.entries(snapshot.counts))
          metrics.gauge('jobs', count, { ...tags, state });
        metrics.gauge(
          'oldest_observed_age_seconds',
          snapshot.oldestObservedAgeMs / 1000,
          tags,
        );
        metrics.gauge('coverage', Number(snapshot.complete), tags);
        metrics.gauge('sample_timestamp', snapshot.timestamp / 1000, tags);
        metrics.gauge('present', 1, tags);
      }
      previousQueues = currentQueues;
      metrics.gauge('queue_count', results.length, attributes);
      metrics.gauge('success', 1, attributes);
      metrics.gauge('last_success_timestamp', Date.now() / 1000, attributes);
    } catch (error) {
      fail(
        signal.aborted || Date.now() >= expiresAt
          ? 'timeout'
          : error instanceof ReviewMetricsQueueLimitError
            ? 'queue_limit'
            : 'read',
      );
    } finally {
      clearTimeout(deadline);
      controller = undefined;
      if (!stopped) {
        timer = setTimeout(poll, intervalMs);
        timer.unref();
      }
    }
  };
  timer = setTimeout(poll, Math.random() * intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    controller?.abort();
    clearTimeout(timer);
    clearTimeout(deadline);
  };
}
