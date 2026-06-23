import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { initialUserScore } from '../../userStatisticsService/computeUserScore.js';

// BullMQ priorities are signed 32-bit ints. Lower = dequeued first. This is the ceiling we invert against
const MAX_BULL_PRIORITY = 2_097_152;

export const JobSortType = {
  FIFO: 'FIFO',
  NUM_REPORTS: 'NUM_REPORTS',
  WEIGHTED: 'WEIGHTED',
} as const;
export type JobSortType = (typeof JobSortType)[keyof typeof JobSortType];

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
  // v2 will add: a loader for org weight overrides, e.g.
  // loadJobPriorityWeights: (orgId: string) => Promise<Map<JobPropertyKey, number>>
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

// One entry today; v2 adds entries here (and `JobPriorityWeights` loads
// per-org overrides that win over `defaultWeight`). Keeping the
// allowlist as data is what lets v2 add properties
// without touching `getJobPriorityForItem`.
const WEIGHTED_PROPERTIES: ReadonlyArray<PropertyConfig> = [
  {
    key: 'numReports',
    normalize: (v) => v,
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
    normalize: (v) => initialUserScore - v,
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
    return toBullPriority(computeScore(contributions));
  }

  // FIFO (and any unrecognised mode): MAX, BullMQ tiebreaks by insertion.
  return MAX_BULL_PRIORITY;
}
