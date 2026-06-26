import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { initialUserScore } from '../../userStatisticsService/computeUserScore.js';

// BullMQ's maximum priority is 2,097,152 (2^21); lower = dequeued first. This
// is the ceiling we invert a score against (priority = MAX - score).
const MAX_BULL_PRIORITY = 2_097_152;

// Each WEIGHTED signal is normalized to [0, 1] before applying its weight, so a
// weight means the same thing across properties ("relative importance") instead
// of "points per raw unit". See WEIGHTED_PROPERTIES below.
//
// `K` is the half-saturation point for # of reports: this many reports
// normalizes to 0.5, and more saturates toward (but never reaches) 1. Tunable —
// raise it to let report count matter over a wider range, lower it to make a
// handful of reports already count as "a lot". (Promote to a per-org setting if
// you want to tune it live alongside the weights.)
export const NUM_REPORTS_HALF_SATURATION_K = 10;

// Lowest possible user score (1 = repeat offender); 5 (`initialUserScore`) is a
// clean user. Used to map the score onto [0, 1].
const MIN_USER_SCORE = 1;

// Normalized weighted scores live in a tiny [0, Σweights] range, but BullMQ
// priority is an integer. Scale the score up before rounding so close-but-
// distinct jobs don't collapse to the same priority (saturated high-report
// jobs intentionally tie and fall back to FIFO).
const WEIGHTED_SCORE_SCALE = 1_000;

export const JobSortType = {
  FIFO: 'FIFO',
  NUM_REPORTS: 'NUM_REPORTS',
  WEIGHTED: 'WEIGHTED',
} as const;
export type JobSortType = (typeof JobSortType)[keyof typeof JobSortType];

// Coerce a raw (DB-stored) `job_sort_type` string into a known JobSortType,
// defaulting to FIFO for missing/unrecognized values. Callers that drive
// priority off a queue's persisted sort type should route through this so an
// unexpected value degrades to FIFO instead of throwing — and, critically, so
// WEIGHTED/NUM_REPORTS are NOT silently collapsed to FIFO at enqueue time.
export function normalizeJobSortType(
  raw: string | null | undefined,
): JobSortType {
  switch (raw) {
    case JobSortType.NUM_REPORTS:
    case JobSortType.WEIGHTED:
    case JobSortType.FIFO:
      return raw;
    default:
      return JobSortType.FIFO;
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

type PropertyConfig = {
  key: JobPropertyKey;
  normalize: (value: number) => number;
  fetch: (opts: {
    orgId: string;
    item: ItemSubmissionWithTypeIdentifier;
    deps: JobPriorityDeps;
  }) => Promise<number>;
};

function userIdentifierFromItem(item: ItemSubmissionWithTypeIdentifier): {
  id: string;
  typeId: string;
} {
  if (item.creator) return item.creator;
  return { id: item.itemId, typeId: item.itemTypeIdentifier.id };
}

// The WEIGHTED signals. Per-org weights (loaded by the service and passed to
// getJobPriorityForItem via `weights`) decide how much each one counts; a signal
// absent from `weights` is skipped. Keeping the allowlist as data lets new
// signals be added here without touching getJobPriorityForItem.
const WEIGHTED_PROPERTIES: ReadonlyArray<PropertyConfig> = [
  {
    key: 'numReports',
    // Saturating normalization onto [0, 1): 0 reports -> 0, K -> 0.5, then
    // diminishing returns. Keeps a viral item from infinitely outweighing a
    // known-bad user.
    normalize: (v) => v / (v + NUM_REPORTS_HALF_SATURATION_K),
    fetch: async ({ orgId, item, deps }) => {
      const count = await deps.getNumTimesReported({
        orgId,
        itemId: item.itemId,
      });
      return count ?? 0;
    },
  },
  {
    key: 'userScore',
    // Map score 1..5 onto [1, 0]: worst user (1) -> 1, clean user (5) -> 0.
    normalize: (v) =>
      (initialUserScore - v) / (initialUserScore - MIN_USER_SCORE),
    fetch: async ({ orgId, item, deps }) =>
      deps.getUserScore(orgId, userIdentifierFromItem(item)),
  },
];

export function computeScore(
  contributions: ReadonlyArray<{ weight: number; normalized: number }>,
): number {
  return contributions.reduce(
    (acc, { weight, normalized }) => acc + weight * normalized,
    0,
  );
}

export function toBullPriority(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_BULL_PRIORITY));
  return MAX_BULL_PRIORITY - Math.round(clamped);
}

export async function getJobPriorityForItem(opts: {
  orgId: string;
  item: ItemSubmissionWithTypeIdentifier;
  sortType: JobSortType;
  deps: JobPriorityDeps;
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
      WEIGHTED_PROPERTIES.filter((p) => weights.has(p.key)).map(async (p) => ({
        weight: weights.get(p.key)!,
        normalized: p.normalize(await p.fetch({ orgId, item, deps })),
      })),
    );
    // computeScore is a weight-sum of [0, 1] signals; scale up so the integer
    // BullMQ priority preserves ordering between close jobs.
    return toBullPriority(computeScore(contributions) * WEIGHTED_SCORE_SCALE);
  }

  // FIFO (and any unrecognised mode): MAX, BullMQ tiebreaks by insertion.
  return MAX_BULL_PRIORITY;
}
