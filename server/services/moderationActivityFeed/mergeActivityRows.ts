import { type JsonValue } from 'type-fest';

import {
  serializeActivityCursor,
  type ActivityCursor,
  type StorePosition,
} from './activityCursor.js';

export type ActivityKind = 'DECISION' | 'MANUAL_ACTION';

export type ActivityRow = {
  kind: ActivityKind;
  /** Decision uuid, or action correlation id. Unique within its own store. */
  id: string;
  ts: Date;
  payload: unknown;
};

/**
 * Interleave two already-sorted feeds into one page.
 *
 * Callers fetch `limit + 1` from each source: in the worst case every row on a
 * page comes from one store, so `limit` from each is the minimum to guarantee
 * a full page, and the extra row is what reveals whether more exists. The
 * surplus is discarded here and re-fetched by the next page — inherent to
 * merging two stores that share no index.
 */
export function mergeActivityRows(
  decisions: readonly ActivityRow[],
  actions: readonly ActivityRow[],
  limit: number,
  incoming: ActivityCursor | undefined,
): { rows: ActivityRow[]; nextCursor: JsonValue | null } {
  const merged = [...decisions, ...actions].sort(byTimeThenKindThenIdDesc);
  const hasMore = merged.length > limit;
  const rows = merged.slice(0, limit);

  if (!hasMore) {
    return { rows, nextCursor: null };
  }

  // Each store advances to the last row OF ITS OWN that survived the cut. A
  // store that contributed nothing to this page keeps its incoming position —
  // resetting it to null would restart that store from the newest row and
  // replay rows the reader has already seen.
  return {
    rows,
    nextCursor: serializeActivityCursor({
      decisions:
        lastPositionOfKind(rows, 'DECISION') ?? incoming?.decisions ?? null,
      actions:
        lastPositionOfKind(rows, 'MANUAL_ACTION') ?? incoming?.actions ?? null,
    }),
  };
}

function lastPositionOfKind(
  rows: readonly ActivityRow[],
  kind: ActivityKind,
): StorePosition | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row.kind === kind) {
      return { ts: row.ts, id: row.id };
    }
  }
  return null;
}

/**
 * Descending by time, then by kind, then by id.
 *
 * The kind leg keeps ordering deterministic when a decision and an action share
 * an instant, and — critically — means ids are only ever compared against ids
 * of the same kind. Decision uuids and action correlation ids live in different
 * namespaces with different collation semantics; comparing across them is what
 * the per-store cursor exists to avoid.
 */
function byTimeThenKindThenIdDesc(a: ActivityRow, b: ActivityRow): number {
  const byTime = b.ts.valueOf() - a.ts.valueOf();
  if (byTime !== 0) {
    return byTime;
  }
  if (a.kind !== b.kind) {
    return a.kind === 'DECISION' ? -1 : 1;
  }
  if (a.id > b.id) {
    return -1;
  }
  if (a.id < b.id) {
    return 1;
  }
  return 0;
}
