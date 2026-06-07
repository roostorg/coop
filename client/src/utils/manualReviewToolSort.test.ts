import {
  buildSortedReviewUrl,
  isSortedReviewMode,
  pickNextSortedJob,
  pickTopSortedJob,
  type SortableJob,
} from './manualReviewTool';

const job = (
  id: string,
  reports: number | null,
  createdAt = '2024-01-01T00:00:00Z',
): SortableJob => ({
  id,
  numTimesReported: reports,
  createdAt,
});

describe('isSortedReviewMode', () => {
  test('returns true for num_reports', () => {
    expect(isSortedReviewMode('num_reports')).toBe(true);
  });

  test('returns true for oldest_first', () => {
    expect(isSortedReviewMode('oldest_first')).toBe(true);
  });

  test('returns false for null', () => {
    expect(isSortedReviewMode(null)).toBe(false);
  });

  test('returns false for arbitrary strings', () => {
    expect(isSortedReviewMode('custom')).toBe(false);
    expect(isSortedReviewMode('')).toBe(false);
  });
});

describe('pickTopSortedJob — num_reports', () => {
  test('returns the job with the most reports', () => {
    const jobs = [job('a', 5), job('b', 20), job('c', 10)];
    expect(pickTopSortedJob(jobs, 'num_reports')?.id).toBe('b');
  });

  test('returns null for empty list', () => {
    expect(pickTopSortedJob([], 'num_reports')).toBeNull();
  });

  test('treats null numTimesReported as 0', () => {
    const jobs = [job('a', null), job('b', 1)];
    expect(pickTopSortedJob(jobs, 'num_reports')?.id).toBe('b');
  });

  test('returns first job when all have equal reports', () => {
    const jobs = [job('a', 5), job('b', 5), job('c', 5)];
    const result = pickTopSortedJob(jobs, 'num_reports');
    expect(result).not.toBeNull();
    expect(result!.numTimesReported).toBe(5);
  });

  test('handles single job', () => {
    expect(pickTopSortedJob([job('a', 0)], 'num_reports')?.id).toBe('a');
  });
});

describe('pickTopSortedJob — oldest_first', () => {
  test('returns the oldest job', () => {
    const jobs = [
      job('a', 5, '2024-03-01T00:00:00Z'),
      job('b', 20, '2024-01-01T00:00:00Z'),
      job('c', 10, '2024-02-01T00:00:00Z'),
    ];
    expect(pickTopSortedJob(jobs, 'oldest_first')?.id).toBe('b');
  });

  test('returns null for empty list', () => {
    expect(pickTopSortedJob([], 'oldest_first')).toBeNull();
  });
});

describe('pickNextSortedJob — num_reports', () => {
  const jobs = [job('a', 50), job('b', 30), job('c', 10), job('d', 5)];

  test('excludes current job and returns highest remaining', () => {
    expect(pickNextSortedJob(jobs, 'a', new Set(), 'num_reports')?.id).toBe(
      'b',
    );
  });

  test('excludes skipped jobs', () => {
    const skipped = new Set(['a', 'b']);
    expect(pickNextSortedJob(jobs, undefined, skipped, 'num_reports')?.id).toBe(
      'c',
    );
  });

  test('excludes both current and skipped jobs', () => {
    const skipped = new Set(['b']);
    expect(pickNextSortedJob(jobs, 'a', skipped, 'num_reports')?.id).toBe('c');
  });

  test('returns null when all jobs are filtered out', () => {
    const skipped = new Set(['b', 'c', 'd']);
    expect(pickNextSortedJob(jobs, 'a', skipped, 'num_reports')).toBeNull();
  });

  test('returns null for empty job list', () => {
    expect(pickNextSortedJob([], 'a', new Set(), 'num_reports')).toBeNull();
  });

  test('works with undefined currentJobId', () => {
    expect(
      pickNextSortedJob(jobs, undefined, new Set(), 'num_reports')?.id,
    ).toBe('a');
  });

  test('sorts by numTimesReported descending', () => {
    const unsorted = [job('x', 1), job('y', 100), job('z', 50)];
    expect(
      pickNextSortedJob(unsorted, undefined, new Set(), 'num_reports')?.id,
    ).toBe('y');
  });

  test('treats null numTimesReported as 0', () => {
    const mixed = [job('a', null), job('b', null), job('c', 3)];
    expect(
      pickNextSortedJob(mixed, undefined, new Set(), 'num_reports')?.id,
    ).toBe('c');
  });
});

describe('pickNextSortedJob — oldest_first', () => {
  const jobs = [
    job('a', 0, '2024-01-01T00:00:00Z'),
    job('b', 0, '2024-02-01T00:00:00Z'),
    job('c', 0, '2024-03-01T00:00:00Z'),
  ];

  test('returns the oldest remaining job', () => {
    expect(
      pickNextSortedJob(jobs, undefined, new Set(), 'oldest_first')?.id,
    ).toBe('a');
  });

  test('excludes current and returns next oldest', () => {
    expect(pickNextSortedJob(jobs, 'a', new Set(), 'oldest_first')?.id).toBe(
      'b',
    );
  });

  test('excludes skipped and returns next oldest', () => {
    const skipped = new Set(['a', 'b']);
    expect(
      pickNextSortedJob(jobs, undefined, skipped, 'oldest_first')?.id,
    ).toBe('c');
  });
});

describe('buildSortedReviewUrl', () => {
  test('builds correct URL with sort param', () => {
    expect(buildSortedReviewUrl('q1', 'j1', 'num_reports')).toBe(
      '/dashboard/manual_review/queues/review/q1/j1?sort=num_reports',
    );
  });
});
