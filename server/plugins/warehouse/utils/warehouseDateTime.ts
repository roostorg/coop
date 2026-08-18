/**
 * Render a `Date` the way `ts` was written, so comparisons are like-for-like.
 * Writes go through `ClickhouseAnalyticsAdapter.formatDate`, which stores UTC
 * wall-clock with no zone suffix (`YYYY-MM-DD HH:MM:SS.mmm`).
 */
export function formatWarehouseDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/** `YYYY-MM-DD`, for comparison against the `ds` partition column. */
export function toDsString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a warehouse timestamp as UTC. ClickHouse returns `DateTime64` without a
 * zone suffix, and `new Date('2026-08-05 12:00:00.000')` reads that shape as
 * *local* time — which would shift every row on a non-UTC host and interleave
 * this feed incorrectly against the Postgres decisions it merges with.
 */
export function parseWarehouseDateTime(value: string): Date {
  const isoish = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(isoish);
  return new Date(hasZone ? isoish : `${isoish}Z`);
}

/**
 * The `ds` partition range a moderator-action feed page must scan.
 *
 * `ACTION_EXECUTIONS` is partitioned by `ds`, so every query needs a bounded
 * range — but deriving it from the wrong anchor silently loses rows, and a
 * feed that lost rows looks exactly like one that has none.
 *
 * - `end` is the newest row the call can return. `HAVING` enforces both
 *   `< cursor` and `<= before`, so it is the tighter of the two. On the first
 *   page there is no cursor, and defaulting to `now` was itself an upper
 *   bound: it made a row dated ahead of the server clock permanently
 *   unreachable, since paging only moves backwards and `before` never widened
 *   the ceiling. Clock skew on a writer host is enough to produce one.
 * - `start` reaches back from `end`, not from `now`. With an `endTime` and no
 *   `startTime` the two differ: anchoring at `now` put the partitions at
 *   `[now - window, now]` while `HAVING max(ts) <= before` excluded every one
 *   of them, so the feed returned nothing at all.
 * - A user-set `after` replaces the rolling window rather than competing with
 *   it. Taking whichever is later silently drops a start date older than the
 *   window: `HAVING` passes but the partitions are already gone.
 */
export function deriveActionScanWindow(opts: {
  cursorTs: Date | undefined;
  after: Date | undefined;
  before: Date | undefined;
  lookbackWindowMs: number;
}): { start: Date; end: Date } {
  const { cursorTs, after, before, lookbackWindowMs } = opts;

  const end = cursorTs
    ? before && before.valueOf() < cursorTs.valueOf()
      ? before
      : cursorTs
    : (before ?? new Date());

  const windowStart = new Date(end.valueOf() - Math.max(1, lookbackWindowMs));

  return { start: after ?? windowStart, end };
}
