import { vi } from 'vitest';

import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../../itemProcessingService/index.js';
import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  getJobPrioritiesForItems,
  getJobPriorityForItem,
  JobSortType,
  MAX_JOB_PRIORITY_WEIGHT,
  toBullPriority,
  userScoreKey,
  type JobPropertyKey,
  type UserIdentifier,
} from './JobPriority.js';

// Hard-coded so that changes to MAX_BULL_PRIORITY require an explicit test update.
const MAX_BULL_PRIORITY = 2_097_151;

const orgId = 'org-1';

function makeItem(opts?: {
  itemId?: string;
  creator?: { id: string; typeId: string };
}): ItemSubmissionWithTypeIdentifier {
  return instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
    itemId: opts?.itemId ?? 'item-1',
    itemTypeIdentifier: {
      id: 'type-1',
      version: '2026-01-01T00:00:00.000Z',
      schemaVariant: 'original',
    },
    creator: opts?.creator,
    submissionId: makeSubmissionId(),
    submissionTime: new Date(),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    data: {} as NormalizedItemData,
  });
}

async function priorityFor(opts: {
  reports?: number | null;
  userScore?: number;
  sortType?: JobSortType;
  weights?: ReadonlyMap<JobPropertyKey, number>;
}): Promise<number | undefined> {
  return getJobPriorityForItem({
    orgId,
    item: makeItem(),
    sortType: opts.sortType ?? JobSortType.NUM_REPORTS,
    deps: {
      getNumTimesReported: async () => opts.reports ?? 0,
      // 5 = a clean user (initialUserScore); 1 = repeat offender.
      getUserScore: async () => opts.userScore ?? 5,
    },
    weights: opts.weights ?? new Map(),
  });
}

describe('JobPriority', () => {
  describe('toBullPriority', () => {
    test('score 0 maps to MAX (back of the prioritized set)', () => {
      expect(toBullPriority(0)).toBe(MAX_BULL_PRIORITY);
    });

    test('positive score subtracts from MAX (higher score = sooner)', () => {
      expect(toBullPriority(5)).toBe(MAX_BULL_PRIORITY - 5);
      expect(toBullPriority(1000)).toBe(MAX_BULL_PRIORITY - 1000);
    });

    test('score above MAX clamps to priority 1 (front of the queue)', () => {
      expect(toBullPriority(MAX_BULL_PRIORITY + 1)).toBe(1);
      expect(toBullPriority(MAX_BULL_PRIORITY * 1000)).toBe(1);
    });

    test('negative score clamps to MAX', () => {
      expect(toBullPriority(-1)).toBe(MAX_BULL_PRIORITY);
      expect(toBullPriority(-1_000_000)).toBe(MAX_BULL_PRIORITY);
    });

    test('non-integer score is rounded before subtraction', () => {
      expect(toBullPriority(100.4)).toBe(MAX_BULL_PRIORITY - 100);
      expect(toBullPriority(100.6)).toBe(MAX_BULL_PRIORITY - 101);
    });
  });

  describe('getJobPriorityForItem — FIFO', () => {
    test('returns no priority so the job stays in BullMQ’s wait list', async () => {
      // Any non-zero priority would route the job into the `prioritized` set
      // instead of `wait`, which is what readers like getOldestJobCreatedAt
      // look at. FIFO must leave the priority unset entirely.
      const priority = await priorityFor({
        reports: 100,
        sortType: JobSortType.FIFO,
      });
      expect(priority).toBeUndefined();
    });

    test('does not fetch any property values', async () => {
      const getNumTimesReported = vi.fn();
      const getUserScore = vi.fn();
      await getJobPriorityForItem({
        orgId,
        item: makeItem(),
        sortType: JobSortType.FIFO,
        deps: { getNumTimesReported, getUserScore },
        weights: new Map(),
      });
      expect(getNumTimesReported).not.toHaveBeenCalled();
      expect(getUserScore).not.toHaveBeenCalled();
    });
  });

  describe('getJobPriorityForItem — NUM_REPORTS', () => {
    test('more reports dequeue sooner (lower priority number)', async () => {
      const fewReports = await priorityFor({ reports: 2 });
      const manyReports = await priorityFor({ reports: 50 });
      expect(manyReports).toBeLessThan(fewReports!);
    });

    test('a re-report moves the same item forward', async () => {
      // Enqueueing an already-queued item recomputes its priority with the
      // new report count; the new priority must be lower (= sooner).
      const before = await priorityFor({ reports: 3 });
      const after = await priorityFor({ reports: 4 });
      expect(after).toBeLessThan(before!);
    });

    test('zero reports lands at MAX, i.e. the back of the queue', async () => {
      expect(await priorityFor({ reports: 0 })).toBe(MAX_BULL_PRIORITY);
    });

    test('null report count is treated as 0', async () => {
      expect(await priorityFor({ reports: null })).toBe(MAX_BULL_PRIORITY);
    });

    test('a report count above MAX clamps to priority 1', async () => {
      expect(await priorityFor({ reports: MAX_BULL_PRIORITY * 10 })).toBe(1);
    });
  });

  describe('getJobPriorityForItem — WEIGHTED', () => {
    // Contributions are linear (weight × value), so expected priorities are
    // exact.
    test('each report adds its weight to the score', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 2]]),
      });
      expect(priority).toBe(MAX_BULL_PRIORITY - 5 * 2);
    });

    test('a higher weight on the same signal dequeues sooner', async () => {
      const light = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 1]]),
      });
      const heavy = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 10]]),
      });
      expect(heavy).toBeLessThan(light!);
    });

    test('each step below a clean user score adds the userScore weight', async () => {
      const worst = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 1,
        weights: new Map([['userScore', 3]]),
      });
      const middling = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 3,
        weights: new Map([['userScore', 3]]),
      });
      const clean = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 5,
        weights: new Map([['userScore', 3]]),
      });
      expect(worst).toBe(MAX_BULL_PRIORITY - 4 * 3);
      expect(middling).toBe(MAX_BULL_PRIORITY - 2 * 3);
      expect(clean).toBe(MAX_BULL_PRIORITY);
    });

    test('high report counts at the max weight still rank distinctly', async () => {
      const weights = new Map<JobPropertyKey, number>([
        ['numReports', MAX_JOB_PRIORITY_WEIGHT],
      ]);
      const fewer = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 9_999,
        weights,
      });
      const more = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 10_000,
        weights,
      });
      expect(more).toBeLessThan(fewer!);
      expect(more).toBeGreaterThan(1);
    });

    test('signals combine additively', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 2,
        userScore: 1,
        weights: new Map([
          ['numReports', 1],
          ['userScore', 4],
        ]),
      });
      // 2 reports × 1 + 4 steps below clean × 4 = 18 points.
      expect(priority).toBe(MAX_BULL_PRIORITY - 18);
    });

    test('with no weights configured, every job ties at MAX (arrival order)', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 100,
        userScore: 1,
        weights: new Map(),
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('content items are scored by their creator', async () => {
      const getUserScore = vi.fn(async () => 1);
      await getJobPriorityForItem({
        orgId,
        item: makeItem({ creator: { id: 'user-42', typeId: 'user-type-2' } }),
        sortType: JobSortType.WEIGHTED,
        deps: { getNumTimesReported: async () => 0, getUserScore },
        weights: new Map([['userScore', 1]]),
      });
      expect(getUserScore).toHaveBeenCalledWith(orgId, {
        id: 'user-42',
        typeId: 'user-type-2',
      });
    });
  });

  describe('getJobPrioritiesForItems', () => {
    // Re-sorting a queue asks for every pending item's priority at once. The
    // point of the batch is that it costs one lookup per signal no matter how
    // many jobs are on the queue.
    const user = (itemId: string): UserIdentifier => ({
      id: `u-${itemId}`,
      typeId: 'user-type',
    });
    const items = (...itemIds: string[]) =>
      itemIds.map((itemId) => ({ itemId, user: user(itemId) }));

    function makeBatchDeps(opts: {
      counts?: Record<string, number>;
      // Keyed by item id; translated to the per-user score map internally.
      scores?: Record<string, number>;
    }) {
      let countLookups = 0;
      let scoreLookups = 0;
      return {
        countLookups: () => countLookups,
        scoreLookups: () => scoreLookups,
        deps: {
          getNumTimesReportedForItems: async (batch: {
            orgId: string;
            itemIds: readonly string[];
          }) => {
            countLookups += 1;
            return new Map(
              Object.entries(opts.counts ?? {}).filter(([itemId]) =>
                batch.itemIds.includes(itemId),
              ),
            );
          },
          getUserScoresForUsers: async (batch: {
            orgId: string;
            users: readonly UserIdentifier[];
          }) => {
            scoreLookups += 1;
            const wanted = new Set(batch.users.map(userScoreKey));
            return new Map(
              Object.entries(opts.scores ?? {})
                .map(
                  ([itemId, score]) =>
                    [userScoreKey(user(itemId)), score] as const,
                )
                .filter(([key]) => wanted.has(key)),
            );
          },
        },
      };
    }

    test('NUM_REPORTS orders items by report count in one lookup', async () => {
      const { countLookups, deps } = makeBatchDeps({ counts: { a: 2, b: 50 } });

      const priorities = await getJobPrioritiesForItems({
        orgId,
        items: items('a', 'b'),
        sortType: JobSortType.NUM_REPORTS,
        deps,
        weights: new Map(),
      });

      expect(priorities.get('b')).toBeLessThan(priorities.get('a')!);
      expect(countLookups()).toBe(1);
    });

    test('items with no reports fall to the back rather than being skipped', async () => {
      // The batch query only returns rows for items that have reports, so an
      // unreported item is absent from the map. It still needs a priority, or
      // the re-sort would leave its old one in place.
      const { deps } = makeBatchDeps({ counts: { reported: 5 } });

      const priorities = await getJobPrioritiesForItems({
        orgId,
        items: items('reported', 'never-reported'),
        sortType: JobSortType.NUM_REPORTS,
        deps,
        weights: new Map(),
      });

      expect(priorities.get('never-reported')).toBe(MAX_BULL_PRIORITY);
      expect(priorities.size).toBe(2);
    });

    test('FIFO demotes every item to priority 0 without querying anything', async () => {
      // 0 is what moves an already-prioritized job back into the wait list
      // when a queue switches from a sorted mode to FIFO.
      const { countLookups, scoreLookups, deps } = makeBatchDeps({
        counts: { a: 2, b: 50 },
      });

      const priorities = await getJobPrioritiesForItems({
        orgId,
        items: items('a', 'b'),
        sortType: JobSortType.FIFO,
        deps,
        weights: new Map(),
      });

      expect(priorities.get('a')).toBe(0);
      expect(priorities.get('b')).toBe(0);
      expect(countLookups()).toBe(0);
      expect(scoreLookups()).toBe(0);
    });

    test('agrees with the single-item path', async () => {
      const { deps } = makeBatchDeps({ counts: { a: 7 } });

      const batched = await getJobPrioritiesForItems({
        orgId,
        items: items('a'),
        sortType: JobSortType.NUM_REPORTS,
        deps,
        weights: new Map(),
      });

      expect(batched.get('a')).toBe(toBullPriority(7));
    });

    test('WEIGHTED combines batched counts and scores in one lookup each', async () => {
      const { countLookups, scoreLookups, deps } = makeBatchDeps({
        counts: { a: 2 },
        scores: { a: 1, b: 5 },
      });

      const priorities = await getJobPrioritiesForItems({
        orgId,
        items: items('a', 'b'),
        sortType: JobSortType.WEIGHTED,
        deps,
        weights: new Map([
          ['numReports', 1],
          ['userScore', 4],
        ]),
      });

      // a: 2 reports × 1 + 4 steps below clean × 4 = 18 points; b: clean,
      // unreported.
      expect(priorities.get('a')).toBe(MAX_BULL_PRIORITY - 18);
      expect(priorities.get('b')).toBe(MAX_BULL_PRIORITY);
      expect(countLookups()).toBe(1);
      expect(scoreLookups()).toBe(1);
    });

    test('WEIGHTED treats users with no score row as clean', async () => {
      const { deps } = makeBatchDeps({ counts: {}, scores: {} });

      const priorities = await getJobPrioritiesForItems({
        orgId,
        items: items('a'),
        sortType: JobSortType.WEIGHTED,
        deps,
        weights: new Map([['userScore', 10]]),
      });

      expect(priorities.get('a')).toBe(MAX_BULL_PRIORITY);
    });

    test('WEIGHTED agrees with the single-item path', async () => {
      const { deps } = makeBatchDeps({
        counts: { a: 3 },
        scores: { a: 1 },
      });
      const weights: ReadonlyMap<JobPropertyKey, number> = new Map([
        ['numReports', 2],
        ['userScore', 4],
      ]);

      const batched = await getJobPrioritiesForItems({
        orgId,
        items: items('a'),
        sortType: JobSortType.WEIGHTED,
        deps,
        weights,
      });
      const single = await getJobPriorityForItem({
        orgId,
        item: makeItem({ itemId: 'a', creator: user('a') }),
        sortType: JobSortType.WEIGHTED,
        deps: {
          getNumTimesReported: async () => 3,
          getUserScore: async () => 1,
        },
        weights,
      });

      expect(batched.get('a')).toBe(single);
    });
  });
});
