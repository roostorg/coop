import { type JsonValue } from 'type-fest';

import { serializeActivityCursor } from './activityCursor.js';

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
 * Callers request up to `limit + 1` rows from each source. If the two together
 * return more than `limit`, at least one row is left for the next page.
 */
export function mergeActivityRows(
  decisions: readonly ActivityRow[],
  actions: readonly ActivityRow[],
  limit: number,
): { rows: ActivityRow[]; nextCursor: JsonValue | null } {
  const merged = [...decisions, ...actions].sort(byTimeThenKindThenIdDesc);
  const rows = merged.slice(0, limit);
  const last = rows.at(-1);

  if (merged.length <= limit || last === undefined) {
    return { rows, nextCursor: null };
  }

  return {
    rows,
    nextCursor: serializeActivityCursor({
      ts: last.ts,
      decisionId: last.kind === 'DECISION' ? last.id : null,
      actionId: last.kind === 'MANUAL_ACTION' ? last.id : null,
    }),
  };
}

/**
 * Descending by time, then by kind, then by id. At the same instant decisions
 * come before actions, and ids are only compared within one kind.
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
