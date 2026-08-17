import { buildActivityCsv, type CsvRow } from './moderationActivityCsv';

const decisionRow: CsvRow = {
  origin: 'Review Job',
  outcome: ['Ban user'],
  policies: ['Spam'],
  reviewer: 'jane@example.com',
  queue: 'Appeals',
  time: '2026-08-05 13:58:00 UTC',
  reason: 'repeat offender',
  itemCount: null,
  failedCount: null,
  link: 'https://example.com/job/1',
};

const actionRow: CsvRow = {
  origin: 'Manual Action',
  outcome: ['Ban user'],
  policies: [],
  reviewer: 'sam@example.com',
  queue: '',
  time: '2026-08-05 13:51:00 UTC',
  reason: null,
  itemCount: 84,
  failedCount: 3,
  link: '',
};

describe('buildActivityCsv', () => {
  it('keeps the original columns for a decisions-only export', () => {
    // Existing tooling parses this file; adding columns unconditionally would
    // break it.
    const csv = buildActivityCsv([decisionRow], false);

    expect(csv.split('\n')[0]).toBe(
      '"Decisions","Policies","Reviewer","Queue","Decision Time","Decision Reason","Link"',
    );
  });

  it('adds Origin, Items and Failed when actions are included', () => {
    const csv = buildActivityCsv([decisionRow, actionRow], true);

    expect(csv.split('\n')[0]).toBe(
      '"Origin","Decisions","Policies","Reviewer","Queue","Decision Time","Decision Reason","Items","Failed","Link"',
    );
  });

  it('escapes quotes and neutralizes spreadsheet formulas', () => {
    const csv = buildActivityCsv(
      [{ ...decisionRow, reason: '=cmd|"/c calc"!A1' }],
      false,
    );

    expect(csv).toContain('\'=cmd|""/c calc""!A1');
  });

  it('leaves the failed column blank when nothing failed', () => {
    const csv = buildActivityCsv([{ ...actionRow, failedCount: 0 }], true);

    expect(csv.split('\n')[1]).toContain(',"84","",');
  });
});
