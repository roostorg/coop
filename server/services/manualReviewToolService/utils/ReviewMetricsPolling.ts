import { type ManualReviewMetrics } from './ManualReviewMetrics.js';
import { type QueueSnapshot } from './ReviewQueueSnapshot.js';

// Poll after completion, never overlap; shutdown stops scheduling but not shared clients.
export function startReviewMetricsPolling(
  metrics: ManualReviewMetrics,
  read: () => Promise<{ queueId: string; snapshot: QueueSnapshot }[]>,
  intervalMs = 60_000,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const attributes = { queue_id: 'all' };
  const poll = async () => {
    metrics.gauge('attempt_timestamp', Date.now() / 1000, attributes);
    try {
      const results = await read();
      if (stopped) return;
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
      }
      metrics.gauge('queue_count', results.length, attributes);
      metrics.gauge('success', 1, attributes);
      metrics.gauge('last_success_timestamp', Date.now() / 1000, attributes);
    } catch {
      if (!stopped) metrics.gauge('success', 0, attributes);
    } finally {
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
    clearTimeout(timer);
  };
}
