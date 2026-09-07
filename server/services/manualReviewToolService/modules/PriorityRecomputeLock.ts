import type IORedis from 'ioredis';
import { type Cluster } from 'ioredis';
import { v1 as uuidv1 } from 'uuid';

type RedisClient = IORedis.Redis | Cluster;

/**
 * Releases the lock only if it still holds our token. Without the check, a
 * sweep that overran its TTL would delete a lock another instance has since
 * legitimately acquired.
 */
const RELEASE_IF_OWNED = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

/**
 * How long a held lock survives without the holder releasing it. Long enough
 * to cover a sweep, which is one Redis round-trip per pending job.
 */
export const RECOMPUTE_LOCK_TTL_MS = 5 * 60 * 1000;

export const RECOMPUTE_LOCK_WAIT_TIMEOUT_MS = RECOMPUTE_LOCK_TTL_MS;

export const RECOMPUTE_LOCK_POLL_INTERVAL_MS = 500;

/**
 * A lock per (org, queue) so only one priority sweep runs at a time, no matter
 * how many API processes are deployed.
 *
 * Keys are hash-tagged with the org id to match the sharding QueueOperations
 * uses for its Bull queues, so an org's keys stay on one Redis slot.
 */
export default class PriorityRecomputeLock {
  constructor(private readonly redis: RedisClient) {}

  #lockKey(orgId: string, queueId: string) {
    return `{${orgId}}:mrt-recompute-lock:${queueId}`;
  }


  async acquireWaiting(opts: {
    orgId: string;
    queueId: string;
    ttlMs?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<string | null> {
    const {
      timeoutMs = RECOMPUTE_LOCK_WAIT_TIMEOUT_MS,
      pollIntervalMs = RECOMPUTE_LOCK_POLL_INTERVAL_MS,
      ...acquireOpts
    } = opts;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const token = await this.acquire(acquireOpts);
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token != null) {
        return token;
      }
      if (Date.now() + pollIntervalMs > deadline) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /** Returns the token to release with, or null if another instance holds it. */
  async acquire(opts: {
    orgId: string;
    queueId: string;
    ttlMs?: number;
  }): Promise<string | null> {
    const { orgId, queueId, ttlMs = RECOMPUTE_LOCK_TTL_MS } = opts;
    const token = uuidv1();
    const result = await this.redis.set(
      this.#lockKey(orgId, queueId),
      token,
      'PX',
      ttlMs,
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  /** Returns true if we still held the lock and released it. */
  async release(opts: {
    orgId: string;
    queueId: string;
    token: string;
  }): Promise<boolean> {
    const { orgId, queueId, token } = opts;
    const released = await this.redis.eval(
      RELEASE_IF_OWNED,
      1,
      this.#lockKey(orgId, queueId),
      token,
    );
    return released === 1;
  }
}
