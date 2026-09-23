import { type JobType } from 'bullmq';

export const reviewQueueStates = [
  'waiting',
  'prioritized',
  'active',
  'delayed',
  'paused',
  'waiting-children',
  'failed',
] as const;

// Public BullMQ APIs may hydrate jobs; payloads never leave this helper.
export type QueueReader = {
  getJobCounts(...states: string[]): Promise<Record<string, number>>;
  getJobs(
    states: JobType[],
    start: number,
    end: number,
    asc: boolean,
  ): Promise<{ timestamp: number }[]>;
};

export type QueueSnapshot = Awaited<ReturnType<typeof createQueueSnapshot>>;

export async function createQueueSnapshot(queue: QueueReader, now = Date.now) {
  const before = await queue.getJobCounts(...reviewQueueStates);
  const waiting = await queue.getJobs(['wait'], 0, 999, true);
  const room = 1000 - waiting.length;
  const prioritized =
    room > 0 ? await queue.getJobs(['prioritized'], 0, room - 1, true) : [];
  const counts = await queue.getJobCounts(...reviewQueueStates);
  if (
    !reviewQueueStates.every(
      (state) => Number.isSafeInteger(counts[state]) && counts[state] >= 0,
    )
  ) {
    throw new Error('Invalid queue counts');
  }
  const timestamp = now();
  const timestamps = [...waiting, ...prioritized].map((job) => job?.timestamp);
  const valid = timestamps.filter(
    (time) => Number.isFinite(time) && time > 0 && time <= timestamp,
  );
  // Count equality cannot prove an atomic snapshot; even complete scans are observations.
  const complete =
    reviewQueueStates.every((state) => before[state] === counts[state]) &&
    waiting.length === counts.waiting &&
    prioritized.length === counts.prioritized &&
    valid.length === timestamps.length;
  return {
    counts,
    oldestObservedAgeMs: valid.length ? timestamp - Math.min(...valid) : 0,
    complete,
    timestamp,
  };
}
