import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';

// BullMQ dequeues the job with the LOWEST priority number first and, among
// equal priorities, the job that arrived first. Our scores mean the opposite
// (bigger = more urgent), so we store priority = MAX_BULL_PRIORITY - score.
//
// BullMQ internally packs the priority and an arrival counter
// into one float64. At priority 2^21 that number outgrows float64's
// exact-integer range, the arrival counter gets rounded, and equal-priority
// jobs stop dequeuing in arrival order. One less keeps the math exact.
export const MAX_BULL_PRIORITY = 2_097_151;

export const JobSortType = {
  FIFO: 'FIFO',
  NUM_REPORTS: 'NUM_REPORTS',
} as const;
export type JobSortType = (typeof JobSortType)[keyof typeof JobSortType];

export type JobPriorityDeps = {
  getNumTimesReported: (opts: {
    orgId: string;
    itemId: string;
  }) => Promise<number | null>;
};

export type BatchJobPriorityDeps = {
  getNumTimesReportedForItems: (opts: {
    orgId: string;
    itemIds: readonly string[];
  }) => Promise<ReadonlyMap<string, number>>;
};

// Convert a "higher = more urgent" score into a BullMQ priority, where lower
// numbers are dequeued first. Scores outside [0, MAX_BULL_PRIORITY] clamp to
// the ends of the range. The minimum returned value is 1 because BullMQ
// treats priority 0 as unprioritized (routes to the `wait` list).
export function toBullPriority(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_BULL_PRIORITY));
  return Math.max(1, MAX_BULL_PRIORITY - Math.round(clamped));
}

/**
 * The BullMQ priority to enqueue an item with, or `undefined` for "no
 * priority".
 *
 * FIFO must return `undefined`, not a number. BullMQ routes any job with a
 * non-zero priority into its `prioritized` sorted set instead of the `wait`
 * list. Stamping FIFO jobs with a priority would therefore move every job on
 * every queue out of `wait` — including queues nobody opted in — and silently
 * break the readers that look there (e.g. `getOldestJobCreatedAt`). Leaving it
 * unset keeps FIFO byte-for-byte identical to the pre-sort-mode behavior.
 */
export async function getJobPriorityForItem(opts: {
  orgId: string;
  item: ItemSubmissionWithTypeIdentifier;
  sortType: JobSortType;
  deps: JobPriorityDeps;
}): Promise<number | undefined> {
  const { orgId, item, deps } = opts;

  if (opts.sortType === JobSortType.NUM_REPORTS) {
    const count = await deps.getNumTimesReported({
      orgId,
      itemId: item.itemId,
    });
    return toBullPriority(count ?? 0);
  }

  return undefined;
}

/**
 * Priorities for many items at once, keyed by item id.
 *
 * Re-sorting a queue needs a priority per pending job. Doing that through
 * `getJobPriorityForItem` would issue one data warehouse query per job, which
 * is exactly the queue size where that becomes untenable — so report counts
 * are fetched in a single batched query instead.
 */
export async function getJobPrioritiesForItems(opts: {
  orgId: string;
  itemIds: readonly string[];
  sortType: JobSortType;
  deps: BatchJobPriorityDeps;
}): Promise<ReadonlyMap<string, number>> {
  const { orgId, itemIds, sortType, deps } = opts;

  if (sortType !== JobSortType.NUM_REPORTS) {
    // Priority 0 means "no priority" to BullMQ, which moves these jobs back
    // out of the `prioritized` set and into the `wait` list. Unlike the
    // enqueue path this has to be an explicit 0 rather than `undefined`: a
    // queue switching back to FIFO needs its already-prioritized jobs
    // actively demoted, not left alone. The sweep walks oldest-first and
    // BullMQ prepends each one, so arrival order is preserved.
    return new Map(itemIds.map((itemId) => [itemId, 0]));
  }

  const counts = await deps.getNumTimesReportedForItems({ orgId, itemIds });
  // Items absent from `counts` have never been reported.
  return new Map(
    itemIds.map((itemId) => [itemId, toBullPriority(counts.get(itemId) ?? 0)]),
  );
}
