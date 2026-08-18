import { buildActivityCsv, type CsvRow } from './moderationActivityCsv';
import { RECENT_DECISIONS_CSV_HEADERS } from './mrtAnalyticsUtils';

const decisionRow: CsvRow = {
  origin: 'Review Job',
  outcome: ['Ban user'],
  policies: ['Spam'],
  reviewer: 'jane@example.com',
  queue: 'Appeals',
  jobCreatedAt: '2026-08-05 13:50:00 UTC',
  claimedAt: '2026-08-05 13:55:00 UTC',
  time: '2026-08-05 13:58:00 UTC',
  waitTimeSeconds: 300,
  handleTimeSeconds: 180,
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
  jobCreatedAt: '',
  claimedAt: '',
  time: '2026-08-05 13:51:00 UTC',
  waitTimeSeconds: '',
  handleTimeSeconds: '',
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
      RECENT_DECISIONS_CSV_HEADERS.map((h) => `"${h}"`).join(','),
    );
  });

  it('adds Origin, Items and Failed when actions are included', () => {
    const csv = buildActivityCsv([decisionRow, actionRow], true);

    expect(csv.split('\n')[0]).toBe(
      '"Origin","Decisions","Policies","Reviewer","Queue","Job Created At","Claimed At","Decision Time","Wait Time (sec)","Handle Time (sec)","Decision Reason","Items","Failed","Link"',
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

  it('writes claim and timing values in their columns', () => {
    const csv = buildActivityCsv([decisionRow], false);

    expect(csv.split('\n')[1]).toBe(
      '"[""Ban user""]","[""Spam""]","jane@example.com","Appeals","2026-08-05 13:50:00 UTC","2026-08-05 13:55:00 UTC","2026-08-05 13:58:00 UTC","300","180","repeat offender","https://example.com/job/1"',
    );
  });
});
