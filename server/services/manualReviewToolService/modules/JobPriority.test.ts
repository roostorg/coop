import type { ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  getJobPriorityForItem,
  JobSortType,
  normalizeJobSortType,
  toBullPriority,
} from './JobPriority.js';

// Deliberately hard-coded rather than imported: BullMQ silently breaks FIFO
// tie-breaking for priorities above 2^21 - 1 (the float64 sort key loses
// integer precision at 2^53), so changing the module's ceiling should require
// consciously updating this test too.
const MAX_BULL_PRIORITY = 2_097_151;

const orgId = 'org-1';

function makeItem(opts?: {
  itemId?: string;
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
    submissionId: 'sub-1',
    submissionTime: new Date(),
    data: {},
  } as unknown as ItemSubmissionWithTypeIdentifier;
}

async function priorityFor(opts: {
  reports?: number | null;
  sortType?: JobSortType;
}): Promise<number> {
  return getJobPriorityForItem({
    orgId,
    item: makeItem(),
    sortType: opts.sortType ?? JobSortType.NUM_REPORTS,
    deps: {
      getNumTimesReported: async () => opts.reports ?? 0,
    },
  });
}

describe('JobPriority', () => {
  describe('normalizeJobSortType', () => {
    test('passes known sort types through unchanged', () => {
      expect(normalizeJobSortType('FIFO')).toBe(JobSortType.FIFO);
      expect(normalizeJobSortType('NUM_REPORTS')).toBe(JobSortType.NUM_REPORTS);
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
      await getJobPriorityForItem({
        orgId,
        item: makeItem(),
        sortType: JobSortType.FIFO,
        deps: { getNumTimesReported },
      });
      expect(getNumTimesReported).not.toHaveBeenCalled();
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
});
