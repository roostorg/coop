import IORedis from 'ioredis';
import { uid } from 'uid';

import PriorityRecomputeLock from './PriorityRecomputeLock.js';

// Two independent clients, so contention is exercised the way it happens in
// production — across connections — rather than within one process.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('PriorityRecomputeLock', () => {
  let clientA: IORedis.Redis;
  let clientB: IORedis.Redis;
  let lockA: PriorityRecomputeLock;
  let lockB: PriorityRecomputeLock;
  let orgId: string;
  let queueId: string;

  beforeEach(() => {
    clientA = new IORedis.default(REDIS_URL, { maxRetriesPerRequest: null });
    clientB = new IORedis.default(REDIS_URL, { maxRetriesPerRequest: null });
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

  describe('version', () => {
    test('starts at 0 for a queue nobody has touched', async () => {
      expect(await lockA.readVersion({ orgId, queueId })).toBe(0);
    });

    test('bumps are visible to other instances', async () => {
      await lockA.bumpVersion({ orgId, queueId });
      expect(await lockB.readVersion({ orgId, queueId })).toBe(1);
    });

    test('a change during a sweep is detectable after it', async () => {
      // This is what stops a slow sweep from committing a stale ordering:
      // the holder compares the version before and after its pass.
      const before = await lockA.readVersion({ orgId, queueId });
      await lockB.bumpVersion({ orgId, queueId });
      const after = await lockA.readVersion({ orgId, queueId });

      expect(after).not.toBe(before);
    });

    test('versions are per queue', async () => {
      const otherQueue = `other-${uid()}`;
      await lockA.bumpVersion({ orgId, queueId });

      expect(await lockA.readVersion({ orgId, queueId: otherQueue })).toBe(0);
    });
  });
});
