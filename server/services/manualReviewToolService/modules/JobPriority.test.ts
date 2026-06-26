import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  getJobPriorityForItem,
  JobSortType,
  normalizeJobSortType,
  toBullPriority,
  type JobPropertyKey,
} from './JobPriority.js';

// BullMQ caps priorities at 2^21; the inversion in toBullPriority subtracts
// the score from this ceiling. Hard-coded here so the tests fail loudly if
// the constant is ever changed without intent (the original PR shipped with
// 2^31 - 1, which BullMQ rejected at runtime).
const MAX_BULL_PRIORITY = 2_097_152;

const orgId = 'org-1';

function makeItem(opts?: {
  itemId?: string;
  itemTypeId?: string;
  creator?: { id: string; typeId: string };
}): ItemSubmissionWithTypeIdentifier {
  // Opaque type from itemProcessingService; cast through unknown rather
  // than wiring the full constructor — the test only needs the fields
  // JobPriority reads.
  return {
    itemId: opts?.itemId ?? 'item-1',
    itemTypeIdentifier: {
      id: opts?.itemTypeId ?? 'type-1',
      version: '2026-01-01T00:00:00.000Z',
      schemaVariant: 'original',
    },
    creator: opts?.creator,
    submissionId: 'sub-1',
    submissionTime: new Date(),
    data: {},
  } as unknown as ItemSubmissionWithTypeIdentifier;
}

// Default item: a CONTENT-shaped submission (has a creator). USER-item
// behaviour is tested explicitly where it matters.
const DEFAULT_CREATOR = { id: 'user-1', typeId: 'user-type-1' };

async function priorityFor(opts: {
  reports?: number | null;
  userScore?: number;
  sortType?: JobSortType;
  weights?: Map<JobPropertyKey, number>;
  item?: ItemSubmissionWithTypeIdentifier;
}): Promise<number> {
  return getJobPriorityForItem({
    orgId,
    item: opts.item ?? makeItem({ creator: DEFAULT_CREATOR }),
    sortType: opts.sortType ?? JobSortType.NUM_REPORTS,
    deps: {
      getNumTimesReported: async () => opts.reports ?? 0,
      getUserScore: async () => opts.userScore ?? 5,
    },
    weights: opts.weights ?? new Map(),
  });
}

describe('JobPriority', () => {
  describe('toBullPriority', () => {
    test('score 0 maps to MAX (back of prioritized set)', () => {
      expect(toBullPriority(0)).toBe(MAX_BULL_PRIORITY);
    });

    test('positive score subtracts from MAX (higher score = sooner)', () => {
      expect(toBullPriority(5)).toBe(MAX_BULL_PRIORITY - 5);
      expect(toBullPriority(1000)).toBe(MAX_BULL_PRIORITY - 1000);
    });

    test('score above MAX clamps to priority 0 (front of queue)', () => {
      expect(toBullPriority(MAX_BULL_PRIORITY + 1)).toBe(0);
      expect(toBullPriority(MAX_BULL_PRIORITY * 1000)).toBe(0);
    });

    test('negative score clamps to MAX (no priority effect)', () => {
      expect(toBullPriority(-1)).toBe(MAX_BULL_PRIORITY);
      expect(toBullPriority(-1_000_000)).toBe(MAX_BULL_PRIORITY);
    });

    test('non-integer score is rounded before subtraction', () => {
      // 100.4 rounds down to 100, 100.6 rounds up to 101.
      expect(toBullPriority(100.4)).toBe(MAX_BULL_PRIORITY - 100);
      expect(toBullPriority(100.6)).toBe(MAX_BULL_PRIORITY - 101);
    });

    test('output never exceeds BullMQ priority cap', () => {
      // Guards against the bug we hit shipping the wrong ceiling.
      for (const score of [0, 1, 100, 999_999, -50, MAX_BULL_PRIORITY * 10]) {
        const priority = toBullPriority(score);
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(MAX_BULL_PRIORITY);
      }
    });
  });

  describe('getJobPriorityForItem — sort mode dispatch', () => {
    test('FIFO returns MAX so BullMQ tiebreaks by insertion order', async () => {
      const priority = await priorityFor({
        reports: 100,
        userScore: 1,
        sortType: JobSortType.FIFO,
      });
      // Even with 100 reports and the worst userScore, FIFO ignores both.
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('FIFO short-circuits before fetching any property values', async () => {
      const getNumTimesReported = jest.fn();
      const getUserScore = jest.fn();
      await getJobPriorityForItem({
        orgId,
        item: makeItem({ creator: DEFAULT_CREATOR }),
        sortType: JobSortType.FIFO,
        deps: { getNumTimesReported, getUserScore },
        weights: new Map([
          ['numReports', 10],
          ['userScore', 5],
        ]),
      });
      // The unnecessary fetches would hit dependent services for every
      // enqueue in a FIFO queue. Cheap guard against a regression.
      expect(getNumTimesReported).not.toHaveBeenCalled();
      expect(getUserScore).not.toHaveBeenCalled();
    });
  });

  describe('getJobPriorityForItem — NUM_REPORTS mode', () => {
    test('priority is driven by numReports alone', async () => {
      const fewerReports = await priorityFor({ reports: 1 });
      const moreReports = await priorityFor({ reports: 10 });
      // The whole reason this feature exists: a job with more reports
      // should be reviewed sooner. Asserts the comparator, not a magic
      // number, so it survives changes to defaults.
      expect(moreReports).toBeLessThan(fewerReports);
    });

    test('userScore is ignored in this mode', async () => {
      // NUM_REPORTS never consults userScore -- only the report count counts.
      const neutralUser = await priorityFor({ reports: 5, userScore: 5 });
      const problematicUser = await priorityFor({ reports: 5, userScore: 1 });
      expect(neutralUser).toBe(problematicUser);
    });

    test('getUserScore is never called in this mode', async () => {
      const getUserScore = jest.fn();
      await getJobPriorityForItem({
        orgId,
        item: makeItem({ creator: DEFAULT_CREATOR }),
        sortType: JobSortType.NUM_REPORTS,
        deps: {
          getNumTimesReported: async () => 5,
          getUserScore,
        },
        weights: new Map(),
      });
      expect(getUserScore).not.toHaveBeenCalled();
    });

    test('weights map is ignored in this mode (NUM_REPORTS does not branch on it)', async () => {
      // Even a populated weights map shouldn't change the priority --
      // weight-driven scoring only kicks in when sortType is WEIGHTED.
      const noWeights = await priorityFor({ reports: 5 });
      const withWeights = await priorityFor({
        reports: 5,
        weights: new Map([
          ['numReports', 100],
          ['userScore', 100],
        ]),
      });
      expect(withWeights).toBe(noWeights);
    });

    test('re-report bumps the same item forward', async () => {
      // Models the live re-rank flow: enqueue recomputes priority as
      // numReports climbs. New priority must be lower (= sooner).
      const before = await priorityFor({ reports: 3 });
      const after = await priorityFor({ reports: 4 });
      expect(after).toBeLessThan(before);
    });

    test('null report count is treated as 0 (no crash, lands at MAX)', async () => {
      const priority = await priorityFor({ reports: null });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('wildly high report count clamps to 0 (still a valid BullMQ priority)', async () => {
      const priority = await priorityFor({ reports: MAX_BULL_PRIORITY * 10 });
      expect(priority).toBe(0);
    });
  });

  describe('getJobPriorityForItem — WEIGHTED mode', () => {
    test('higher weight on the same property => sooner dequeue', async () => {
      const light = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 1]]),
      });
      const heavy = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 100]]),
      });
      // The user-visible knob v1.1 exposes: cranking weight makes that
      // property dominate the score.
      expect(heavy).toBeLessThan(light);
    });

    test('properties without a weight entry do not contribute', async () => {
      // Admin sets only userScore weight; numReports has no row.
      // Two jobs differ only in reports -> they sort identically because
      // numReports has no weight.
      const fewReports = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 1,
        userScore: 3,
        weights: new Map([['userScore', 10]]),
      });
      const manyReports = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 100,
        userScore: 3,
        weights: new Map([['userScore', 10]]),
      });
      expect(fewReports).toBe(manyReports);
    });

    test('weight 0 turns the property off (priority lands at MAX)', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 42,
        weights: new Map([['numReports', 0]]),
      });
      // weight 0 * reports 42 = 0 contribution => MAX. Confirms 0 is
      // honoured as a real value, not coerced via `||` to a default.
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('empty weights map => no contributions => priority lands at MAX', async () => {
      // WEIGHTED mode with no weights configured is a valid (if useless)
      // setup: every property contributes 0 -> score 0 -> MAX -> FIFO
      // behaviour via BullMQ tiebreak.
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 100,
        userScore: 1,
        weights: new Map(),
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('worse userScore => sooner dequeue (the inversion is wired)', async () => {
      // UserScore 1..5 with 5 = neutral, 1 = worst. After normalize:
      // worse user yields larger contribution -> lower priority number.
      const goodUser = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 5,
        weights: new Map([['userScore', 10]]),
      });
      const badUser = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 1,
        weights: new Map([['userScore', 10]]),
      });
      expect(badUser).toBeLessThan(goodUser);
    });

    test('neutral userScore (5) contributes nothing', async () => {
      // Per the inversion (initialUserScore - v), score 5 maps to 0.
      const onlyUserScore = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 5,
        weights: new Map([['userScore', 10]]),
      });
      expect(onlyUserScore).toBe(MAX_BULL_PRIORITY);
    });

    test('multiple weighted properties contribute additively', async () => {
      // numReports + userScore both contribute. A job with both signals
      // should sort sooner than one with only the report signal.
      const reportsOnly = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        userScore: 5, // neutral, contributes 0
        weights: new Map([
          ['numReports', 10],
          ['userScore', 10],
        ]),
      });
      const reportsAndBadUser = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        userScore: 1, // worst, contributes 4 * weight
        weights: new Map([
          ['numReports', 10],
          ['userScore', 10],
        ]),
      });
      expect(reportsAndBadUser).toBeLessThan(reportsOnly);
    });

    test('USER-kind item (no creator) uses itself as the user identifier', async () => {
      // USER items have no `creator` field; the fetcher treats the item
      // itself as the user. The test verifies via the getUserScore mock
      // receiving the item's own identifier.
      const getUserScore = jest.fn().mockResolvedValue(1);
      await getJobPriorityForItem({
        orgId,
        item: makeItem({ itemId: 'user-99', itemTypeId: 'user-type-9' }),
        sortType: JobSortType.WEIGHTED,
        deps: {
          getNumTimesReported: async () => 0,
          getUserScore,
        },
        weights: new Map([['userScore', 1]]),
      });
      expect(getUserScore).toHaveBeenCalledWith(orgId, {
        id: 'user-99',
        typeId: 'user-type-9',
      });
    });

    test('CONTENT-kind item uses item.creator as the user identifier', async () => {
      const getUserScore = jest.fn().mockResolvedValue(1);
      await getJobPriorityForItem({
        orgId,
        item: makeItem({
          itemId: 'post-1',
          itemTypeId: 'content-type-1',
          creator: { id: 'user-42', typeId: 'user-type-2' },
        }),
        sortType: JobSortType.WEIGHTED,
        deps: {
          getNumTimesReported: async () => 0,
          getUserScore,
        },
        weights: new Map([['userScore', 1]]),
      });
      expect(getUserScore).toHaveBeenCalledWith(orgId, {
        id: 'user-42',
        typeId: 'user-type-2',
      });
    });

    test('report count saturates: +10 reports matters far more at low counts than high', async () => {
      // Normalized as reports / (reports + K), so equal increments have
      // diminishing returns — a viral item can't infinitely outrank everything.
      const w = new Map<JobPropertyKey, number>([['numReports', 10]]);
      const at0 = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 0,
        weights: w,
      });
      const at10 = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 10,
        weights: w,
      });
      const at100 = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 100,
        weights: w,
      });
      const at110 = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 110,
        weights: w,
      });
      // Priority is MAX - score; more reports => lower number. The 0->10 jump
      // should dwarf the 100->110 jump.
      expect(at0 - at10).toBeGreaterThan(at100 - at110);
    });

    test('with comparable weights, a worse user outranks an item with more reports', async () => {
      // The whole point of normalizing both signals to [0, 1]: equal weights
      // now mean equal importance, so a repeat offender with few reports can
      // beat a clean user with many. (reports 30 -> 0.75*10 = 7.5; worst user
      // -> 1.0*10 = 10, plus a little from 3 reports.)
      const weights = new Map<JobPropertyKey, number>([
        ['numReports', 10],
        ['userScore', 10],
      ]);
      const manyReportsCleanUser = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 30,
        userScore: 5,
        weights,
      });
      const fewReportsWorstUser = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 3,
        userScore: 1,
        weights,
      });
      expect(fewReportsWorstUser).toBeLessThan(manyReportsCleanUser);
    });

    test('output always fits in BullMQ priority range across realistic inputs', async () => {
      for (const reports of [
        0,
        1,
        100,
        1_000,
        100_000,
        MAX_BULL_PRIORITY * 5,
      ]) {
        for (const userScore of [1, 3, 5]) {
          for (const numReportsWeight of [0, 1, 10, 100]) {
            for (const userScoreWeight of [0, 1, 10, 100]) {
              const priority = await priorityFor({
                sortType: JobSortType.WEIGHTED,
                reports,
                userScore,
                weights: new Map([
                  ['numReports', numReportsWeight],
                  ['userScore', userScoreWeight],
                ]),
              });
              expect(priority).toBeGreaterThanOrEqual(0);
              expect(priority).toBeLessThanOrEqual(MAX_BULL_PRIORITY);
            }
          }
        }
      }
    });
  });

  describe('normalizeJobSortType', () => {
    test('passes known sort types through unchanged', () => {
      expect(normalizeJobSortType('FIFO')).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType('NUM_REPORTS')).toBe(JobSortType.NUM_REPORTS);
      // Regression: WEIGHTED used to be collapsed to FIFO at enqueue time, so
      // a weighted queue ignored its weights for newly enqueued jobs.
      expect(normalizeJobSortType('WEIGHTED')).toBe(JobSortType.WEIGHTED);
    });

    test('defaults missing / unrecognized values to FIFO', () => {
      expect(normalizeJobSortType(undefined)).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType(null)).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType('')).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType('SOMETHING_ELSE')).toBe(JobSortType.FIFO);
    });
  });
});
