import { type JobType } from 'bullmq';

import {
  createQueueSnapshot,
  reviewQueueStates,
  type QueueReader,
} from './ReviewQueueSnapshot.js';

const counts = (waiting = 0, prioritized = 0) => ({
  waiting,
  prioritized,
  active: 0,
  delayed: 0,
  paused: 0,
  'waiting-children': 0,
  failed: 0,
});
const reader = (
  before = counts(),
  waiting: number[] = [],
  prioritized: number[] = [],
  after = before,
): QueueReader => {
  let read = 0;
  return {
    getJobCounts: jest.fn(async () => (++read === 1 ? before : after)),
    getJobs: jest.fn(async (states: JobType[], _start: number, end: number) =>
      (states[0] === 'wait' ? waiting : prioritized)
        .slice(0, end + 1)
        .map((timestamp) => ({ timestamp })),
    ),
  };
};

describe('public API queue snapshots', () => {
  it('records an empty successful snapshot without negative sentinels', async () => {
    const result = await createQueueSnapshot(reader(), () => 1000);
    expect(result).toEqual({
      counts: counts(),
      oldestObservedAgeMs: 0,
      complete: true,
      timestamp: 1000,
    });
  });
  it('separates deferred/active counts and inspects priorities regardless of age order', async () => {
    const c = { ...counts(2, 1), active: 2, delayed: 3, paused: 4 };
    const q = reader(c, [200, 900], [100]);
    const result = await createQueueSnapshot(q, () => 1000);
    expect(result.oldestObservedAgeMs).toBe(900);
    expect(result.complete).toBe(true);
    expect(result.counts).toEqual(c);
    expect(q.getJobCounts).toHaveBeenCalledWith(...reviewQueueStates);
    expect(q.getJobs).toHaveBeenNthCalledWith(2, ['prioritized'], 0, 997, true);
  });
  it('marks changing counts, missing timestamps and future timestamps incomplete', async () => {
    expect(
      (
        await createQueueSnapshot(
          reader(counts(1), [100], [], counts(0)),
          () => 1000,
        )
      ).complete,
    ).toBe(false);
    expect(
      (await createQueueSnapshot(reader(counts(2), [100, NaN]), () => 1000))
        .complete,
    ).toBe(false);
    expect(
      (await createQueueSnapshot(reader(counts(1), [2000]), () => 1000))
        .complete,
    ).toBe(false);
  });
  it('caps timestamp reads at 1000 and labels partial age as incomplete', async () => {
    const q = reader(
      counts(1200, 4),
      Array.from({ length: 1200 }, () => 100),
      [20],
    );
    const result = await createQueueSnapshot(q, () => 1000);
    expect(q.getJobs).toHaveBeenCalledTimes(1);
    expect(result.complete).toBe(false);
    expect(result.oldestObservedAgeMs).toBe(900);
  });
  it('propagates failed reads and rejects invalid counts', async () => {
    const q = reader();
    jest.spyOn(q, 'getJobCounts').mockRejectedValueOnce(new Error('offline'));
    await expect(createQueueSnapshot(q)).rejects.toThrow('offline');
    await expect(createQueueSnapshot(reader(counts(-1)))).rejects.toThrow(
      'Invalid queue counts',
    );
  });
});
