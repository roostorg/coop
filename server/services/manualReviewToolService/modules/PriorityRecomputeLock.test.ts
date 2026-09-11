import IORedis from 'ioredis';
import { uid } from 'uid';

import PriorityRecomputeLock from './PriorityRecomputeLock.js';

// Two independent clients, so contention is exercised the way it happens in
// production — across connections — rather than within one process.
//
// Read the same env vars the DI container reads. There is no `REDIS_URL` in
// this repo, so reaching for one silently fell back to localhost, which is
// nothing inside the CI container.
const redisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  // BullMQ needs `maxRetriesPerRequest: null` for its blocking commands; these
  // tests don't, and unbounded retries turn an unreachable Redis into a hang
  // that only ends when CI kills the job. Give up instead, so the test fails.
  maxRetriesPerRequest: 1,
  retryStrategy: (times: number) => (times > 3 ? null : 100),
};

describe('PriorityRecomputeLock', () => {
  let clientA: IORedis.Redis;
  let clientB: IORedis.Redis;
  let lockA: PriorityRecomputeLock;
  let lockB: PriorityRecomputeLock;
  let orgId: string;
  let queueId: string;

  beforeEach(() => {
    clientA = new IORedis.default(redisOptions);
    clientB = new IORedis.default(redisOptions);
    lockA = new PriorityRecomputeLock(clientA);
    lockB = new PriorityRecomputeLock(clientB);
    // Unique per test so runs don't collide with each other or leftover state.
    orgId = `test-org-${uid()}`;
    queueId = `test-queue-${uid()}`;
  });

  afterEach(async () => {
    await clientA.quit();
    await clientB.quit();
  });

  describe('acquire', () => {
    test('a second instance cannot take a held lock', async () => {
      const tokenA = await lockA.acquire({ orgId, queueId });
      const tokenB = await lockB.acquire({ orgId, queueId });

      expect(tokenA).not.toBeNull();
      expect(tokenB).toBeNull();
    });

    test('the lock is per queue, so other queues are unaffected', async () => {
      const tokenA = await lockA.acquire({ orgId, queueId });
      const otherQueue = await lockB.acquire({
        orgId,
        queueId: `other-${uid()}`,
      });

      expect(tokenA).not.toBeNull();
      expect(otherQueue).not.toBeNull();
    });

    test('releasing lets the next instance in', async () => {
      const tokenA = await lockA.acquire({ orgId, queueId });
      await lockA.release({ orgId, queueId, token: tokenA! });

      expect(await lockB.acquire({ orgId, queueId })).not.toBeNull();
    });

    test('a lock whose holder died expires on its own', async () => {
      // Stand-in for a process that crashed mid-sweep: it never releases, so
      // the TTL is the only thing that frees the queue.
      await lockA.acquire({ orgId, queueId, ttlMs: 150 });
      expect(await lockB.acquire({ orgId, queueId })).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(await lockB.acquire({ orgId, queueId })).not.toBeNull();
    });
  });

  describe('release', () => {
    test('will not release a lock held by someone else', async () => {
      // The dangerous case: A overruns its TTL, B acquires, then A finishes
      // and tries to release. A must not free B's lock.
      await lockA.acquire({ orgId, queueId, ttlMs: 150 });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const tokenB = await lockB.acquire({ orgId, queueId });

      const releasedByStaleHolder = await lockA.release({
        orgId,
        queueId,
        token: 'a-stale-token',
      });

      expect(releasedByStaleHolder).toBe(false);
      // B still holds it.
      expect(await lockA.acquire({ orgId, queueId })).toBeNull();
      await lockB.release({ orgId, queueId, token: tokenB! });
    });

    test('releasing an unheld lock is a no-op, not an error', async () => {
      expect(await lockA.release({ orgId, queueId, token: 'never-held' })).toBe(
        false,
      );
    });
  });

  describe('acquireWaiting', () => {
    test('takes the lock immediately when it is free', async () => {
      const token = await lockA.acquireWaiting({ orgId, queueId });
      expect(token).not.toBeNull();
    });

    test('waits for the holder to release, then takes it', async () => {
      const heldBy = await lockA.acquire({ orgId, queueId });
      expect(heldBy).not.toBeNull();

      const waiting = lockB.acquireWaiting({
        orgId,
        queueId,
        pollIntervalMs: 10,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await lockA.release({ orgId, queueId, token: heldBy! });

      expect(await waiting).not.toBeNull();
    });

    test('gives up once the timeout elapses if the holder never releases', async () => {
      await lockA.acquire({ orgId, queueId });

      expect(
        await lockB.acquireWaiting({
          orgId,
          queueId,
          timeoutMs: 60,
          pollIntervalMs: 10,
        }),
      ).toBeNull();
    });

    test('a waiter on one queue is not blocked by another queue', async () => {
      await lockA.acquire({ orgId, queueId });

      const other = await lockB.acquireWaiting({
        orgId,
        queueId: `other-${uid()}`,
        timeoutMs: 60,
        pollIntervalMs: 10,
      });
      expect(other).not.toBeNull();
    });
  });
});
