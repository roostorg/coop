export type CsvRow = {
  origin: 'Review Job' | 'Manual Action';
  outcome: string[];
  policies: string[];
  reviewer: string;
  queue: string;
  time: string;
  reason: string | null;
  itemCount: number | null;
  failedCount: number | null;
  link: string;
};

/**
 * Escape per RFC 4180 and neutralize spreadsheet formula injection. A leading
 * =, +, - or @ is prefixed with an apostrophe so Excel treats it as text.
 * This is a moderation audit log; a decision reason is free text a moderator
 * typed, so it can't be trusted not to look like a formula.
 *
 * Exported so the skips CSV export (which isn't built from `CsvRow`s — it
 * pages a different, offset-based query — see `ManualReviewRecentDecisions`)
 * can format its fields the same way rather than duplicating this logic.
 */
export function escapeCsvField(value: string): string {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/**
 * Column layout follows the Show control. A decisions-only export keeps the
 * original column set (`Decisions, Policies, Reviewer, Queue, Decision Time,
 * Decision Reason, Link`) so existing downstream tooling that parses this
 * file is unaffected. `Origin`, `Items` and `Failed` only appear once actions
 * are mixed into the export.
 */
export function buildActivityCsv(
  rows: readonly CsvRow[],
  includeActions: boolean,
): string {
  const headers = [
    ...(includeActions ? ['Origin'] : []),
    'Decisions',
    'Policies',
    'Reviewer',
    'Queue',
    'Decision Time',
    'Decision Reason',
    ...(includeActions ? ['Items', 'Failed'] : []),
    'Link',
  ];

  const body = rows.map((row) => [
    ...(includeActions ? [row.origin] : []),
    JSON.stringify(row.outcome),
    JSON.stringify(row.policies),
    row.reviewer,
    row.queue,
    row.time,
    row.reason ?? '',
    ...(includeActions
      ? [
          row.itemCount === null ? '' : String(row.itemCount),
          row.failedCount ? String(row.failedCount) : '',
        ]
      : []),
    row.link,
  ]);

  return [headers, ...body]
    .map((line) => line.map(escapeCsvField).join(','))
    .join('\n');
}
