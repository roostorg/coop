import {
  getJobPriorityForItem,
  JobSortType,
  toBullPriority,
} from './JobPriority.js';

// BullMQ caps priorities at 2^21; the inversion in toBullPriority subtracts
// the score from this ceiling. Hard-coded here so the tests fail loudly if
// the constant is ever changed without intent (the original PR shipped with
// 2^31 - 1, which BullMQ rejected at runtime).
const MAX_BULL_PRIORITY = 2_097_152;

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

  describe('getJobPriorityForItem', () => {
    const orgId = 'org-1';
    const itemId = 'item-1';

    test('FIFO returns MAX so BullMQ tiebreaks by insertion order', async () => {
      const getNumTimesReported = jest.fn();
      const priority = await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.FIFO,
        deps: { getNumTimesReported },
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('FIFO does not fetch report counts (the dispatch short-circuits)', async () => {
      const getNumTimesReported = jest.fn();
      await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.FIFO,
        deps: { getNumTimesReported },
      });
      expect(getNumTimesReported).not.toHaveBeenCalled();
    });

    test('NUM_REPORTS with 0 reports lands at MAX (same as FIFO)', async () => {
      const getNumTimesReported = jest.fn().mockResolvedValue(0);
      const priority = await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.NUM_REPORTS,
        deps: { getNumTimesReported },
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
      expect(getNumTimesReported).toHaveBeenCalledWith({ orgId, itemId });
    });

    test('NUM_REPORTS with N reports subtracts N from MAX', async () => {
      const getNumTimesReported = jest.fn().mockResolvedValue(42);
      const priority = await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.NUM_REPORTS,
        deps: { getNumTimesReported },
      });
      expect(priority).toBe(MAX_BULL_PRIORITY - 42);
    });

    test('NUM_REPORTS treats null report count as 0', async () => {
      // ReportingService.getNumTimesReported is typed `number | null` — null
      // means "no reporting data," which we score as zero rather than crash.
      const getNumTimesReported = jest.fn().mockResolvedValue(null);
      const priority = await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.NUM_REPORTS,
        deps: { getNumTimesReported },
      });
      expect(priority).toBe(MAX_BULL_PRIORITY);
    });

    test('NUM_REPORTS with a wildly high count still produces a valid priority', async () => {
      // Real queues won't exceed 2M reports per item, but defending against
      // overflow keeps BullMQ's `validateOptions` from rejecting the enqueue.
      const getNumTimesReported = jest
        .fn()
        .mockResolvedValue(MAX_BULL_PRIORITY * 5);
      const priority = await getJobPriorityForItem({
        orgId,
        itemId,
        sortType: JobSortType.NUM_REPORTS,
        deps: { getNumTimesReported },
      });
      expect(priority).toBe(0);
    });
  });
});
