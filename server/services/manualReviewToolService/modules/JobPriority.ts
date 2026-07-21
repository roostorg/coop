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

// Coerce a raw (DB-stored) `job_sort_type` string into a known JobSortType.
// Missing values (queues created before the sort-type column existed, or a
// queue that wasn't found) mean FIFO — the historical behavior. Anything else
// is a bug somewhere upstream (the column has a CHECK constraint), so fail
// loudly rather than silently mis-sorting the queue.
export function normalizeJobSortType(
  raw: string | null | undefined,
): JobSortType {
  if (raw == null) {
    return JobSortType.FIFO;
  }
  switch (raw) {
    case JobSortType.FIFO:
    case JobSortType.NUM_REPORTS:
      return raw;
    default:
      throw new Error(`Unknown job_sort_type: "${raw}"`);
  }
}

export type JobPriorityDeps = {
  getNumTimesReported: (opts: {
    orgId: string;
    itemId: string;
  }) => Promise<number | null>;
};

// Convert a "higher = more urgent" score into a BullMQ priority, where lower
// numbers are dequeued first. Scores outside [0, MAX_BULL_PRIORITY] clamp to
// the ends of the range.
export function toBullPriority(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_BULL_PRIORITY));
  return MAX_BULL_PRIORITY - Math.round(clamped);
}

export async function getJobPriorityForItem(opts: {
  orgId: string;
  item: ItemSubmissionWithTypeIdentifier;
  sortType: JobSortType;
  deps: JobPriorityDeps;
}): Promise<number> {
  const { orgId, item, deps } = opts;

  if (opts.sortType === JobSortType.NUM_REPORTS) {
    const count = await deps.getNumTimesReported({
      orgId,
      itemId: item.itemId,
    });
    return toBullPriority(count ?? 0);
  }

  // FIFO: every job gets the same priority and BullMQ tiebreaks by insertion
  // order, i.e. arrival order.
  return MAX_BULL_PRIORITY;
}
