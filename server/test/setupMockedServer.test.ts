import { getBottleContainerWithIOMocks } from './setupMockedServer.js';

describe('getBottleContainerWithIOMocks', () => {
  test.each([
    'itemSubmissionQueueBulkWrite',
    'itemSubmissionRetryQueueBulkWrite',
  ] as const)('%s does not initialize real Redis clients', async (name) => {
    const deps = await getBottleContainerWithIOMocks();
    try {
      const write = deps[name];
      await write([]);
      await write.close();

      // Bottle replaces a factory getter with its value on first access.
      // Queue writers in the I/O-mocked harness must leave Redis unresolved,
      // avoiding both network connections and the real writer's drain delay.
      for (const redis of ['IORedis', 'IORedisEnqueueNoBuffer'] as const) {
        expect(Object.getOwnPropertyDescriptor(deps, redis)?.get).toEqual(
          expect.any(Function),
        );
      }
    } finally {
      await deps.closeSharedResourcesForShutdown();
    }
  });
});
