// BullMQ priorities are signed 32-bit ints. Lower = dequeued first. This is the ceiling we invert against
const MAX_BULL_PRIORITY = 2_097_152;

export const JobSortType = {
  FIFO: 'FIFO',
  NUM_REPORTS: 'NUM_REPORTS',
} as const;
export type JobSortType = (typeof JobSortType)[keyof typeof JobSortType];

export type PropertyKey = 'numReports';

export type JobPriorityDeps = {
  getNumTimesReported: (opts: {
    orgId: string;
    itemId: string;
  }) => Promise<number | null>;
  // v2 will add: a loader for org weight overrides, e.g.
  // loadJobPriorityWeights: (orgId: string) => Promise<Map<PropertyKey, number>>
};

type PropertyConfig = {
  key: PropertyKey;
  defaultWeight: number;
  normalize: (value: number) => number;
  fetch: (opts: {
    orgId: string;
    itemId: string;
    deps: JobPriorityDeps;
  }) => Promise<number>;
};

// One entry today; v2 adds entries here (and `JobPriorityWeights` loads
// per-org overrides that win over `defaultWeight`). Keeping the
// allowlist as data is what lets v2 add properties
// without touching `getJobPriorityForItem`.
export const WEIGHTED_PROPERTIES: ReadonlyArray<PropertyConfig> = [
  {
    key: 'numReports',
    defaultWeight: 1,
    normalize: (v: number) => v,
    fetch: async ({ orgId, itemId, deps }) => {
      const count = await deps.getNumTimesReported({ orgId, itemId });
      return count ?? 0;
    },
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
  itemId: string;
  sortType: JobSortType;
  deps: JobPriorityDeps;
}): Promise<number> {
  if (opts.sortType === JobSortType.FIFO) {
    return MAX_BULL_PRIORITY;
  }
  const { orgId, itemId, deps } = opts;
  // `Promise.all` is overkill for one property but is the natural shape
  // once v2 adds more (each `fetch` is an independent async lookup).
  const contributions = await Promise.all(
    WEIGHTED_PROPERTIES.map(async (p) => ({
      weight: p.defaultWeight,
      normalized: p.normalize(await p.fetch({ orgId, itemId, deps })),
    })),
  );
  return toBullPriority(computeScore(contributions));
}
