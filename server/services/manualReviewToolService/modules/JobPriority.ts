import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { initialUserScore } from '../../userStatisticsService/computeUserScore.js';

// BullMQ dequeues the job with the LOWEST priority number first and, among
// equal priorities, the job that arrived first.
//
// 2^21 - 1 is the highest priority BullMQ can handle without breaking
// FIFO tie-breaking among equal priorities.
export const MAX_BULL_PRIORITY = 2_097_151;

export const JobSortType = {
  FIFO: 'FIFO',
  NUM_REPORTS: 'NUM_REPORTS',
  WEIGHTED: 'WEIGHTED',
} as const;
export type JobSortType = (typeof JobSortType)[keyof typeof JobSortType];

export type JobPropertyKey = 'numReports' | 'userScore';

export type UserIdentifier = { id: string; typeId: string };

export type JobPriorityDeps = {
  getNumTimesReported: (opts: {
    orgId: string;
    itemId: string;
  }) => Promise<number | null>;
  getUserScore: (
    orgId: string,
    userItemIdentifier: UserIdentifier,
  ) => Promise<number>;
};

export type BatchJobPriorityDeps = {
  getNumTimesReportedForItems: (opts: {
    orgId: string;
    itemIds: readonly string[];
  }) => Promise<ReadonlyMap<string, number>>;
  getUserScoresForUsers: (opts: {
    orgId: string;
    users: readonly UserIdentifier[];
  }) => Promise<ReadonlyMap<string, number>>;
};

/** Key for the per-user score maps returned by `getUserScoresForUsers`. */
export function userScoreKey(user: UserIdentifier): string {
  return `${user.typeId}\x00${user.id}`;
}

// Convert a "higher = more urgent" score into a BullMQ priority, where lower
// numbers are dequeued first. Scores outside [0, MAX_BULL_PRIORITY] clamp to
// the ends of the range. The minimum returned value is 1 because BullMQ
// treats priority 0 as unprioritized (routes to the `wait` list).
export function toBullPriority(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_BULL_PRIORITY));
  return Math.max(1, MAX_BULL_PRIORITY - Math.round(clamped));
}

export const MAX_JOB_PRIORITY_WEIGHT = 10;

// Content/thread items are scored by their author; user items by the user
// itself.
export function userIdentifierFromItem(
  item: ItemSubmissionWithTypeIdentifier,
): UserIdentifier {
  if (item.creator) return item.creator;
  return { id: item.itemId, typeId: item.itemTypeIdentifier.id };
}

// The weighted score for one job. Weights multiply linearly: `weight × value`
// points each.
//   - numReports: the raw report count, so a weight means "points per report".
//   - userScore: steps below a clean user (0 to 4), so a weight means "points
//     per step". At equal weights, a worst-offender user counts like four
//     reports.
// A signal with no weight (or weight 0) contributes nothing, and if every
// signal is unweighted all jobs tie, i.e. arrival order.
function weightedScore(opts: {
  weights: ReadonlyMap<JobPropertyKey, number>;
  numReports: number;
  userScore: number;
}): number {
  const reportsWeight = opts.weights.get('numReports') ?? 0;
  const userScoreWeight = opts.weights.get('userScore') ?? 0;
  return (
    reportsWeight * opts.numReports +
    userScoreWeight * (initialUserScore - opts.userScore)
  );
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
  // Per-org weights for WEIGHTED queues; ignored by other sort modes.
  weights: ReadonlyMap<JobPropertyKey, number>;
}): Promise<number | undefined> {
  const { orgId, item, deps, weights } = opts;

  if (opts.sortType === JobSortType.NUM_REPORTS) {
    const count = await deps.getNumTimesReported({
      orgId,
      itemId: item.itemId,
    });
    return toBullPriority(count ?? 0);
  }

  if (opts.sortType === JobSortType.WEIGHTED) {
    const [numReports, userScore] = await Promise.all([
      deps.getNumTimesReported({ orgId, itemId: item.itemId }),
      deps.getUserScore(orgId, userIdentifierFromItem(item)),
    ]);
    return toBullPriority(
      weightedScore({ weights, numReports: numReports ?? 0, userScore }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (opts.sortType === JobSortType.FIFO) {
    return undefined;
  }

  throw new Error(`Unrecognized sort type: ${String(opts.sortType)}`);
}

/**
 * Priorities for many items at once, keyed by item id.
 *
 * Re-sorting a queue needs a priority per pending job. Doing that through
 * `getJobPriorityForItem` would issue one data warehouse query per job, which
 * is exactly the queue size where that becomes untenable — so report counts
 * (and, for WEIGHTED queues, user scores) are fetched in batched queries
 * instead.
 */
export async function getJobPrioritiesForItems(opts: {
  orgId: string;
  items: ReadonlyArray<{ itemId: string; user: UserIdentifier }>;
  sortType: JobSortType;
  deps: BatchJobPriorityDeps;
  // Per-org weights for WEIGHTED queues; ignored by other sort modes.
  weights: ReadonlyMap<JobPropertyKey, number>;
}): Promise<ReadonlyMap<string, number>> {
  const { orgId, items, sortType, deps, weights } = opts;

  if (sortType === JobSortType.FIFO) {
    // Priority 0 means "no priority" to BullMQ, which moves these jobs back
    // out of the `prioritized` set and into the `wait` list. Unlike the
    // enqueue path this has to be an explicit 0 rather than `undefined`: a
    // queue switching back to FIFO needs its already-prioritized jobs
    // actively demoted, not left alone. The sweep walks oldest-first and
    // BullMQ prepends each one, so arrival order is preserved.
    return new Map(items.map(({ itemId }) => [itemId, 0]));
  }

  if (sortType === JobSortType.NUM_REPORTS) {
    const counts = await deps.getNumTimesReportedForItems({
      orgId,
      itemIds: items.map((it) => it.itemId),
    });
    // Items absent from `counts` have never been reported.
    return new Map(
      items.map(({ itemId }) => [
        itemId,
        toBullPriority(counts.get(itemId) ?? 0),
      ]),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (sortType !== JobSortType.WEIGHTED) {
    throw new Error(`Unrecognized sort type: ${String(sortType)}`);
  }

  const [counts, scores] = await Promise.all([
    deps.getNumTimesReportedForItems({
      orgId,
      itemIds: items.map((it) => it.itemId),
    }),
    deps.getUserScoresForUsers({
      orgId,
      users: items.map((it) => it.user),
    }),
  ]);
  return new Map(
    items.map(({ itemId, user }) => [
      itemId,
      toBullPriority(
        weightedScore({
          weights,
          numReports: counts.get(itemId) ?? 0,
          // Users with no score row are clean, i.e. contribute nothing.
          userScore: scores.get(userScoreKey(user)) ?? initialUserScore,
        }),
      ),
    ]),
  );
}
