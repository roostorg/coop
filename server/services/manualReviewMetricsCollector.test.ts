import {
  registerReviewMetricsCollector,
  ReviewMetricsQueueLimitError,
  startReviewMetricsCollector,
  type ReadReviewQueueSnapshots,
} from './manualReviewMetricsCollector.js';

const snapshot = {
  counts: { waiting: 0 },
  oldestObservedAgeMs: 0,
  complete: true,
  timestamp: 1,
};
function readerFixture() {
  return {
    getAllQueuesForOrgAndDangerouslyBypassPermissioning: jest
      .fn()
      .mockResolvedValue([{ id: 'q', isAppealsQueue: false }]),
    getMetricsSnapshot: jest.fn().mockResolvedValue(snapshot),
  };
}

it('does not read queues when no collector is registered', () => {
  const queues = readerFixture();
  expect(startReviewMetricsCollector(queues)).toBeUndefined();
  expect(
    queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning,
  ).not.toHaveBeenCalled();
});

it('exposes only a scoped, bounded reader and stops the adapter during shutdown', async () => {
  const queues = readerFixture();
  const stop = jest.fn();
  let read!: ReadReviewQueueSnapshots;
  const unregister = registerReviewMetricsCollector((callback) => {
    read = callback;
    return stop;
  });
  try {
    const close = startReviewMetricsCollector(queues);
    expect(queues.getMetricsSnapshot).not.toHaveBeenCalled();
    const signal = new AbortController().signal;
    await expect(read('org', signal)).resolves.toEqual([
      { queueId: 'q', snapshot },
    ]);
    expect(
      queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning,
    ).toHaveBeenCalledWith('org', 51);
    expect(queues.getMetricsSnapshot).toHaveBeenCalledWith(
      { orgId: 'org', queueId: 'q', isAppealsQueue: false },
      signal,
    );
    close?.();
    expect(stop).toHaveBeenCalledTimes(1);
  } finally {
    unregister();
  }
});

it('rejects oversized listings, missing scope and cancelled reads before further work', async () => {
  const queues = readerFixture();
  let read!: ReadReviewQueueSnapshots;
  const unregister = registerReviewMetricsCollector((callback) => {
    read = callback;
    return () => {};
  });
  const close = startReviewMetricsCollector(queues);
  try {
    await expect(read('', new AbortController().signal)).rejects.toThrow(
      'scope',
    );
    expect(
      queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning,
    ).not.toHaveBeenCalled();
    queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, i) => ({
        id: `${i}`,
        isAppealsQueue: false,
      })),
    );
    await expect(read('org', new AbortController().signal)).rejects.toThrow(
      ReviewMetricsQueueLimitError,
    );
    expect(queues.getMetricsSnapshot).not.toHaveBeenCalled();
    const controller = new AbortController();
    queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning.mockImplementationOnce(
      async () => {
        controller.abort();
        return [{ id: 'q', isAppealsQueue: false }];
      },
    );
    await expect(read('org', controller.signal)).rejects.toThrow();
    expect(queues.getMetricsSnapshot).not.toHaveBeenCalled();
    queues.getAllQueuesForOrgAndDangerouslyBypassPermissioning.mockResolvedValueOnce(
      [
        { id: 'a', isAppealsQueue: false },
        { id: 'b', isAppealsQueue: true },
      ],
    );
    const afterFirst = new AbortController();
    queues.getMetricsSnapshot.mockImplementationOnce(async () => {
      afterFirst.abort();
      return snapshot;
    });
    await expect(read('org', afterFirst.signal)).rejects.toThrow();
    expect(queues.getMetricsSnapshot).toHaveBeenCalledTimes(1);
  } finally {
    close?.();
    unregister();
  }
});

it('keeps registration cleanup safe in either order and isolates adapter failures', () => {
  const a = jest.fn(() => () => {});
  const b = jest.fn(() => () => {
    throw new Error('close');
  });
  const removeA = registerReviewMetricsCollector(a);
  const removeB = registerReviewMetricsCollector(b);
  try {
    removeA();
    const close = startReviewMetricsCollector(readerFixture());
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    expect(() => close?.()).not.toThrow();
    removeB();
    expect(startReviewMetricsCollector(readerFixture())).toBeUndefined();
  } finally {
    removeA();
    removeB();
  }
  const removeBad = registerReviewMetricsCollector(() => {
    throw new Error('start');
  });
  try {
    expect(startReviewMetricsCollector(readerFixture())).toBeUndefined();
  } finally {
    removeBad();
  }
});
