import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { initialUserScore } from '../../userStatisticsService/computeUserScore.js';

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
  WEIGHTED: 'WEIGHTED',
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
    case JobSortType.WEIGHTED:
      return raw;
    default:
      throw new Error(`Unknown job_sort_type: "${raw}"`);
  }
}

export type JobPropertyKey = 'numReports' | 'userScore';

export type JobPriorityDeps = {
  getNumTimesReported: (opts: {
    orgId: string;
    itemId: string;
  }) => Promise<number | null>;
  getUserScore: (
    orgId: string,
    userItemIdentifier: { id: string; typeId: string },
  ) => Promise<number>;
};

// Convert a "higher = more urgent" score into a BullMQ priority, where lower
// numbers are dequeued first. Scores outside [0, MAX_BULL_PRIORITY] clamp to
// the ends of the range.
export function toBullPriority(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_BULL_PRIORITY));
  return MAX_BULL_PRIORITY - Math.round(clamped);
}

// Lowest possible user score. 1 = repeat offender; 5 (`initialUserScore`) is
// a clean user.
const MIN_USER_SCORE = 1;

// A weighted score is scaled up by this factor before becoming an (integer)
// BullMQ priority, so fractional contributions — a user score maps onto
// [0, 1] — survive rounding instead of collapsing into ties.
const WEIGHTED_SCORE_SCALE = 1_000;

function userIdentifierFromItem(item: ItemSubmissionWithTypeIdentifier): {
  id: string;
  typeId: string;
} {
  // Content/thread items are scored by their author; user items by the user
  // itself.
  if (item.creator) return item.creator;
  return { id: item.itemId, typeId: item.itemTypeIdentifier.id };
}

// The value each weighted signal contributes, BEFORE its weight is applied.
// Weights multiply linearly: `weight × value` points each.
//   - numReports: the raw report count, so a weight means "points per report".
//   - userScore: mapped onto [0, 1] (worst offender = 1, clean user = 0), so
//     a weight means "points when the user is at their worst". At equal
//     weights, a worst-offender user counts like one report.
const WEIGHTED_PROPERTIES: ReadonlyArray<{
  key: JobPropertyKey;
  value: (opts: {
    orgId: string;
    item: ItemSubmissionWithTypeIdentifier;
    deps: JobPriorityDeps;
  }) => Promise<number>;
}> = [
  {
    key: 'numReports',
    value: async ({ orgId, item, deps }) =>
      (await deps.getNumTimesReported({ orgId, itemId: item.itemId })) ?? 0,
  },
  {
    key: 'userScore',
    value: async ({ orgId, item, deps }) => {
      const score = await deps.getUserScore(
        orgId,
        userIdentifierFromItem(item),
      );
      return (initialUserScore - score) / (initialUserScore - MIN_USER_SCORE);
    },
  },
];

export async function getJobPriorityForItem(opts: {
  orgId: string;
  item: ItemSubmissionWithTypeIdentifier;
  sortType: JobSortType;
  deps: JobPriorityDeps;
  // Per-org weights for WEIGHTED queues; ignored by other sort modes. A
  // signal with no weight (or weight 0) contributes nothing, and if every
  // signal is unweighted all jobs tie, i.e. FIFO.
  weights: ReadonlyMap<JobPropertyKey, number>;
}): Promise<number> {
  const { orgId, item, deps, weights } = opts;

  if (opts.sortType === JobSortType.NUM_REPORTS) {
    const count = await deps.getNumTimesReported({
      orgId,
      itemId: item.itemId,
    });
    return toBullPriority(count ?? 0);
  }

  if (opts.sortType === JobSortType.WEIGHTED) {
    const contributions = await Promise.all(
      WEIGHTED_PROPERTIES.map(async (property) => {
        const weight = weights.get(property.key);
        if (weight == null || weight === 0) {
          return 0;
        }
        return weight * (await property.value({ orgId, item, deps }));
      }),
    );
    const score = contributions.reduce((total, c) => total + c, 0);
    return toBullPriority(score * WEIGHTED_SCORE_SCALE);
  }

  // FIFO: every job gets the same priority and BullMQ tiebreaks by insertion
  // order, i.e. arrival order.
  return MAX_BULL_PRIORITY;
}
