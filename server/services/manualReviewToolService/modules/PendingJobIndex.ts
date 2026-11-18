import type IORedis from 'ioredis';
import { type Cluster } from 'ioredis';

type RedisClient = IORedis.Redis | Cluster;

// Marks an index as complete. Scored below every real createdAt so it always
// sits at rank 0, and it lives inside the index key so the marker and the
// entries can only ever disappear together. JobIds are base64url segments
// joined by ':', so they can never collide with it.
const BUILT_SENTINEL = '!built';

export type PendingJobIndexEntry = { jobId: string; createdAtMs: number };

/**
 * A per-queue Redis sorted set of JobIds scored by `createdAt`, so the oldest
 * job can be found without scanning BullMQ's `prioritized` set (which is
 * ordered by priority, not age).
 *
 * The index is a superset of the queue's live jobs, not an exact mirror:
 * entries are written before the job is enqueued, and dequeued (active) jobs
 * keep their entry so they're already indexed if they return to the queue.
 * Readers must confirm each candidate against BullMQ and drop the ones whose
 * job is gone. Members are JobIds rather than BullJobIds because a BullJobId
 * is reused for every job on the same item; a JobId names exactly one job, so
 * removing one can never drop a newer job's entry.
 */
export default class PendingJobIndex {
  constructor(private readonly redis: RedisClient) {}

  #key(orgId: string, queueId: string) {
    return `{${orgId}}:mrt-pending-by-created:${queueId}`;
  }

  async add(opts: {
    orgId: string;
    queueId: string;
    entries: readonly PendingJobIndexEntry[];
  }) {
    const { orgId, queueId, entries } = opts;
    if (entries.length === 0) {
      return;
    }
    await this.redis.zadd(
      this.#key(orgId, queueId),
      ...entries.flatMap(({ jobId, createdAtMs }) => [createdAtMs, jobId]),
    );
  }

  async remove(opts: {
    orgId: string;
    queueId: string;
    jobIds: readonly string[];
  }) {
    const { orgId, queueId, jobIds } = opts;
    if (jobIds.length === 0) {
      return;
    }
    await this.redis.zrem(this.#key(orgId, queueId), ...jobIds);
  }

  /**
   * Returns up to `count` entries, oldest first, starting at `offset` (not
   * counting the built marker).
   */
  async range(opts: {
    orgId: string;
    queueId: string;
    offset: number;
    count: number;
  }): Promise<PendingJobIndexEntry[]> {
    const { orgId, queueId, offset, count } = opts;
    const flat = await this.redis.zrange(
      this.#key(orgId, queueId),
      offset + 1,
      offset + count,
      'WITHSCORES',
    );
    const entries: PendingJobIndexEntry[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      entries.push({ jobId: flat[i], createdAtMs: Number(flat[i + 1]) });
    }
    return entries;
  }

  async isBuilt(opts: { orgId: string; queueId: string }) {
    const score = await this.redis.zscore(
      this.#key(opts.orgId, opts.queueId),
      BUILT_SENTINEL,
    );
    return score != null;
  }

  async markBuilt(opts: { orgId: string; queueId: string }) {
    await this.redis.zadd(
      this.#key(opts.orgId, opts.queueId),
      '-inf',
      BUILT_SENTINEL,
    );
  }

  /**
   * Drops every entry and the built marker, so readers fall back to scanning
   * BullMQ until a backfill rebuilds the index.
   */
  async clear(opts: { orgId: string; queueId: string }) {
    await this.redis.del(this.#key(opts.orgId, opts.queueId));
  }
}
