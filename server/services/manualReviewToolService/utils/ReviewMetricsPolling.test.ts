import { ManualReviewMetrics } from './ManualReviewMetrics.js';
import { startReviewMetricsPolling } from './ReviewMetricsPolling.js';

const wait = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

it('does not overlap reads and stops scheduling after shutdown', async () => {
  let resolve!: (value: []) => void;
  const read = jest.fn(
    async () =>
      new Promise<[]>((r) => {
        resolve = r;
      }),
  );
  const metrics = new ManualReviewMetrics();
  const gauge = jest.spyOn(metrics, 'gauge');
  const stop = startReviewMetricsPolling(metrics, read, 5);
  try {
    await wait(30);
    expect(read).toHaveBeenCalledTimes(1);
    stop();
    resolve([]);
    await wait(30);
    expect(read).toHaveBeenCalledTimes(1);
    expect(gauge).not.toHaveBeenCalledWith('success', 1, expect.anything());
  } finally {
    stop();
    jest.restoreAllMocks();
  }
});

it('publishes health failure then recovers without negative gauges', async () => {
  const metrics = new ManualReviewMetrics();
  const gauge = jest.spyOn(metrics, 'gauge');
  const read = jest
    .fn()
    .mockRejectedValueOnce(new Error('database details'))
    .mockResolvedValue([]);
  const stop = startReviewMetricsPolling(metrics, read, 5);
  try {
    await wait(50);
    expect(gauge).toHaveBeenCalledWith('success', 0, { queue_id: 'all' });
    expect(gauge).toHaveBeenCalledWith('success', 1, { queue_id: 'all' });
    expect(gauge).toHaveBeenCalledWith('queue_count', 0, { queue_id: 'all' });
  } finally {
    stop();
    jest.restoreAllMocks();
  }
});
