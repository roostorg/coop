import { ManualReviewMetrics } from './ManualReviewMetrics.js';
import {
  ReviewMetricsQueueLimitError,
  startReviewMetricsPolling,
} from './ReviewMetricsPolling.js';
import {
  reviewQueueStates,
  type QueueSnapshot,
} from './ReviewQueueSnapshot.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function clock() {
  let now = 100_000;
  let tasks = new Map<number, { run: () => Promise<void>; delay: number }>();
  let id = 0;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(global, 'setTimeout').mockImplementation(((
    run: () => Promise<void>,
    delay: number,
  ) => {
    const token = ++id;
    tasks = new Map([...tasks, [token, { run, delay }]]);
    return { token, unref() {} };
  }) as unknown as typeof setTimeout);
  jest.spyOn(global, 'clearTimeout').mockImplementation(((
    timer: { token: number } | undefined,
  ) => {
    if (timer)
      tasks = new Map([...tasks].filter(([key]) => key !== timer.token));
  }) as unknown as typeof clearTimeout);
  return {
    set: (value: number) => {
      now = value;
    },
    count: () => tasks.size,
    run: async (delay: number) => {
      const task = [...tasks.entries()].find(([, t]) => t.delay === delay);
      if (!task) throw new Error(`No scheduled ${delay}ms callback`);
      tasks = new Map([...tasks].filter(([key]) => key !== task[0]));
      return task[1].run();
    },
  };
}
const row = (queueId = 'queue') => ({
  queueId,
  snapshot: {
    counts: Object.fromEntries(
      reviewQueueStates.map((state) => [state, state === 'waiting' ? 3 : 0]),
    ),
    oldestObservedAgeMs: 8_000,
    complete: true,
    timestamp: 100_000,
  } satisfies QueueSnapshot,
});

describe('review metrics polling', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clears every removed-queue gauge only after a complete successful list, and supports reappearance', async () => {
    const c = clock();
    const metrics = new ManualReviewMetrics();
    const gauge = jest.spyOn(metrics, 'gauge');
    const event = jest.spyOn(metrics, 'event');
    const read = jest
      .fn()
      .mockResolvedValueOnce([row()])
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row()]);
    const stop = startReviewMetricsPolling(metrics, read, 100, 20);
    try {
      await c.run(0);
      gauge.mockClear();
      await c.run(100);
      expect(gauge).not.toHaveBeenCalledWith('present', 0, {
        queue_id: 'queue',
      });
      await c.run(100);
      for (const state of reviewQueueStates)
        expect(gauge).toHaveBeenCalledWith('jobs', 0, {
          queue_id: 'queue',
          state,
        });
      expect(gauge).toHaveBeenCalledWith('oldest_observed_age_seconds', 0, {
        queue_id: 'queue',
      });
      expect(gauge).toHaveBeenCalledWith('coverage', 1, { queue_id: 'queue' });
      expect(gauge).toHaveBeenCalledWith('present', 0, { queue_id: 'queue' });
      expect(event).toHaveBeenCalledWith('queue_removed', {
        queue_id: 'queue',
      });
      gauge.mockClear();
      await c.run(100);
      expect(gauge).toHaveBeenCalledWith('present', 1, { queue_id: 'queue' });
      expect(gauge).toHaveBeenCalledWith('jobs', 3, {
        queue_id: 'queue',
        state: 'waiting',
      });
    } finally {
      stop();
    }
  });

  it.each(['resolve', 'reject'] as const)(
    'reports a deadline once, rejects late %s, and never overlaps reads',
    async (settlement) => {
      const c = clock();
      const metrics = new ManualReviewMetrics();
      const gauge = jest.spyOn(metrics, 'gauge');
      const event = jest.spyOn(metrics, 'event');
      const pending = deferred<ReturnType<typeof row>[]>();
      const read = jest
        .fn()
        .mockImplementationOnce(async () => pending.promise)
        .mockResolvedValue([]);
      const stop = startReviewMetricsPolling(metrics, read, 100, 20);
      try {
        const run = c.run(0);
        c.set(100_020);
        await c.run(20);
        expect(read.mock.calls[0][0].aborted).toBe(true);
        expect(event).toHaveBeenCalledTimes(1);
        expect(event).toHaveBeenCalledWith('collection_failed_timeout', {
          queue_id: 'all',
        });
        expect(gauge).toHaveBeenCalledWith('success', 0, { queue_id: 'all' });
        expect(c.count()).toBe(0);
        c.set(500_000);
        expect(read).toHaveBeenCalledTimes(1);
        if (settlement === 'resolve') pending.resolve([row()]);
        else pending.reject(new Error('late read rejection'));
        await run;
        expect(event).toHaveBeenCalledTimes(1);
        expect(gauge).not.toHaveBeenCalledWith('success', 1, {
          queue_id: 'all',
        });
        expect(gauge).not.toHaveBeenCalledWith('present', 1, expect.anything());
        await c.run(100);
        expect(gauge).toHaveBeenCalledWith('success', 1, { queue_id: 'all' });
      } finally {
        stop();
      }
    },
  );

  it('rejects overdue success even when event-loop delay postpones the timeout callback', async () => {
    const c = clock();
    const metrics = new ManualReviewMetrics();
    const event = jest.spyOn(metrics, 'event');
    const read = jest.fn(async () => {
      c.set(100_021);
      return [row()];
    });
    const stop = startReviewMetricsPolling(metrics, read, 100, 20);
    try {
      await c.run(0);
      expect(event).toHaveBeenCalledWith('collection_failed_timeout', {
        queue_id: 'all',
      });
    } finally {
      stop();
    }
  });

  it('retains bounded failure counts across recovery and never exports error messages', async () => {
    const c = clock();
    const metrics = new ManualReviewMetrics();
    const event = jest.spyOn(metrics, 'event');
    const read = jest
      .fn()
      .mockRejectedValueOnce(new Error('private database details'))
      .mockRejectedValueOnce(
        new ReviewMetricsQueueLimitError('too many queues'),
      )
      .mockResolvedValue([]);
    const stop = startReviewMetricsPolling(metrics, read, 100, 20);
    try {
      await c.run(0);
      await c.run(100);
      await c.run(100);
      expect(event.mock.calls).toEqual([
        ['collection_failed_read', { queue_id: 'all' }],
        ['collection_failed_queue_limit', { queue_id: 'all' }],
      ]);
    } finally {
      stop();
    }
  });

  it.each(['resolve', 'reject'] as const)(
    'shutdown aborts scheduling without metrics from a late %s',
    async (settlement) => {
      const c = clock();
      const metrics = new ManualReviewMetrics();
      const gauge = jest.spyOn(metrics, 'gauge');
      const event = jest.spyOn(metrics, 'event');
      const pending = deferred<ReturnType<typeof row>[]>();
      const read = jest.fn(async () => pending.promise);
      const stop = startReviewMetricsPolling(metrics, read, 100, 20);
      const run = c.run(0);
      stop();
      gauge.mockClear();
      expect(c.count()).toBe(0);
      if (settlement === 'resolve') pending.resolve([row()]);
      else pending.reject(new Error('offline'));
      await run;
      expect(gauge).not.toHaveBeenCalled();
      expect(event).not.toHaveBeenCalled();
      expect(c.count()).toBe(0);
    },
  );
});
