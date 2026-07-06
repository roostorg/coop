import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  getJobPriorityForItem,
  JobSortType,
  normalizeJobSortType,
  toBullPriority,
  type JobPropertyKey,
} from './JobPriority.js';

// Deliberately hard-coded rather than imported: BullMQ silently breaks FIFO
// tie-breaking for priorities above 2^21 - 1 (the float64 sort key loses
// integer precision at 2^53), so changing the module's ceiling should require
// consciously updating this test too.
const MAX_BULL_PRIORITY = 2_097_151;

const orgId = 'org-1';

function makeItem(opts?: {
  itemId?: string;
  creator?: { id: string; typeId: string };
}): ItemSubmissionWithTypeIdentifier {
  // Opaque type from itemProcessingService; cast through unknown rather than
  // wiring the full constructor — these tests only need the fields
  // JobPriority reads.
  return {
    itemId: opts?.itemId ?? 'item-1',
    itemTypeIdentifier: {
      id: 'type-1',
      version: '2026-01-01T00:00:00.000Z',
      schemaVariant: 'original',
    },
    creator: opts?.creator,
    submissionId: 'sub-1',
    submissionTime: new Date(),
    data: {},
  } as unknown as ItemSubmissionWithTypeIdentifier;
}

async function priorityFor(opts: {
  reports?: number | null;
  userScore?: number;
  sortType?: JobSortType;
  weights?: ReadonlyMap<JobPropertyKey, number>;
}): Promise<number> {
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
  describe('normalizeJobSortType', () => {
    test('passes known sort types through unchanged', () => {
      expect(normalizeJobSortType('FIFO')).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType('NUM_REPORTS')).toBe(JobSortType.NUM_REPORTS);
      expect(normalizeJobSortType('WEIGHTED')).toBe(JobSortType.WEIGHTED);
    });

    test('defaults missing values to FIFO', () => {
      // Queues created before the sort-type column existed, or a queue that
      // was not found, behave like they always have: FIFO.
      expect(normalizeJobSortType(undefined)).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType(null)).toBe(JobSortType.FIFO);
    });

    test('throws on unrecognized values', () => {
      // The column has a CHECK constraint, so an unknown value means a bug;
      // fail loudly instead of silently mis-sorting the queue.
      expect(() => normalizeJobSortType('')).toThrow(/Unknown job_sort_type/);
      expect(() => normalizeJobSortType('SOMETHING_ELSE')).toThrow(
        /Unknown job_sort_type/,
      );
    });
  });

  describe('toBullPriority', () => {
    test('score 0 maps to MAX (back of the prioritized set)', () => {
      expect(toBullPriority(0)).toBe(MAX_BULL_PRIORITY);
    });

    test('positive score subtracts from MAX (higher score = sooner)', () => {
      expect(toBullPriority(5)).toBe(MAX_BULL_PRIORITY - 5);
      expect(toBullPriority(1000)).toBe(MAX_BULL_PRIORITY - 1000);
    });

    test('score above MAX clamps to priority 0 (front of the queue)', () => {
      expect(toBullPriority(MAX_BULL_PRIORITY + 1)).toBe(0);
      expect(toBullPriority(MAX_BULL_PRIORITY * 1000)).toBe(0);
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
    test('returns MAX so BullMQ tiebreaks by insertion order', async () => {
      // FIFO ignores report counts entirely.
      const priority = await priorityFor({
        reports: 100,
        sortType: JobSortType.FIFO,
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('does not fetch any property values', async () => {
      const getNumTimesReported = jest.fn();
      const getUserScore = jest.fn();
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
      expect(manyReports).toBeLessThan(fewReports);
    });

    test('a re-report moves the same item forward', async () => {
      // Enqueueing an already-queued item recomputes its priority with the
      // new report count; the new priority must be lower (= sooner).
      const before = await priorityFor({ reports: 3 });
      const after = await priorityFor({ reports: 4 });
      expect(after).toBeLessThan(before);
    });

    test('zero reports lands at MAX, tied with FIFO arrivals', async () => {
      expect(await priorityFor({ reports: 0 })).toBe(MAX_BULL_PRIORITY);
    });

    test('null report count is treated as 0', async () => {
      expect(await priorityFor({ reports: null })).toBe(MAX_BULL_PRIORITY);
    });

    test('a report count above MAX clamps to priority 0', async () => {
      expect(await priorityFor({ reports: MAX_BULL_PRIORITY * 10 })).toBe(0);
    });
  });

  describe('getJobPriorityForItem — WEIGHTED', () => {
    // Contributions are linear (weight × value) and the score is scaled by
    // 1000 before inverting, so expected priorities are exact.
    test('each report adds its weight to the score', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 5,
        weights: new Map([['numReports', 2]]),
      });
      expect(priority).toBe(MAX_BULL_PRIORITY - 5 * 2 * 1000);
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
      expect(heavy).toBeLessThan(light);
    });

    test('a worst-offender user contributes the full userScore weight; a clean user none', async () => {
      const worst = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 1,
        weights: new Map([['userScore', 3]]),
      });
      const clean = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        userScore: 5,
        weights: new Map([['userScore', 3]]),
      });
      expect(worst).toBe(MAX_BULL_PRIORITY - 3 * 1000);
      expect(clean).toBe(MAX_BULL_PRIORITY);
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
      // 2 reports × 1 + worst user × 4 = 6 points.
      expect(priority).toBe(MAX_BULL_PRIORITY - 6 * 1000);
    });

    test('with no weights configured, every job ties at MAX (FIFO order)', async () => {
      const priority = await priorityFor({
        sortType: JobSortType.WEIGHTED,
        reports: 100,
        userScore: 1,
        weights: new Map(),
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('an unweighted signal is not fetched', async () => {
      const getNumTimesReported = jest.fn(async () => 5);
      const getUserScore = jest.fn(async () => 1);
      await getJobPriorityForItem({
        orgId,
        item: makeItem(),
        sortType: JobSortType.WEIGHTED,
        deps: { getNumTimesReported, getUserScore },
        weights: new Map([['numReports', 1]]),
      });
      expect(getNumTimesReported).toHaveBeenCalled();
      expect(getUserScore).not.toHaveBeenCalled();
    });

    test('content items are scored by their creator', async () => {
      const getUserScore = jest.fn(async () => 1);
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
});
