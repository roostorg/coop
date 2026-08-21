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
 * How long a held lock survives without the holder releasing it.
 *
 * Deliberately generous rather than watchdog-extended: a sweep is O(pending
 * jobs) Redis round-trips, and a lock that expires mid-sweep would let a
 * second instance start one concurrently — the exact thing this prevents. The
 * cost of erring long is that a process which dies mid-sweep leaves the queue
 * unswept for up to this long. That degrades ordering, it doesn't break it:
 * every new and re-reported job is still stamped correctly at enqueue.
 */
export const RECOMPUTE_LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * Cross-instance coordination for manual review queue priority sweeps.
 *
 * Two pieces:
 *
 * - A **lock** per (org, queue), so only one sweep runs at a time no matter
 *   how many API processes are deployed. An in-process Map can't do this.
 * - A **version** per (org, queue), bumped every time the sort mode changes.
 *   The holder re-reads it after sweeping; if it moved, someone changed the
 *   mode mid-sweep and the sweep runs again with the new mode. That's also
 *   what makes it safe for a losing instance to simply drop its own sweep —
 *   it has already recorded its intent by bumping the version, and whoever
 *   holds the lock will see it.
 *
 * Keys are hash-tagged with the org id to match the sharding QueueOperations
 * uses for its Bull queues, so an org's keys stay on one Redis slot.
 */
export default class PriorityRecomputeLock {
  constructor(private readonly redis: RedisClient) {}

  #lockKey(orgId: string, queueId: string) {
    return `{${orgId}}:mrt-recompute-lock:${queueId}`;
  }

  #versionKey(orgId: string, queueId: string) {
    return `{${orgId}}:mrt-recompute-version:${queueId}`;
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

  /** Records that the queue's ordering is stale. Call before scheduling. */
  async bumpVersion(opts: { orgId: string; queueId: string }): Promise<number> {
    const { orgId, queueId } = opts;
    return this.redis.incr(this.#versionKey(orgId, queueId));
  }

  async readVersion(opts: { orgId: string; queueId: string }): Promise<number> {
    const { orgId, queueId } = opts;
    const raw = await this.redis.get(this.#versionKey(orgId, queueId));
    return raw == null ? 0 : Number(raw);
  }
}
