import { type JsonValue } from 'type-fest';

import { makeBadRequestError } from '../../utils/errors.js';

/** One store's position. `id` is only ever compared within its own store. */
export type StorePosition = {
  ts: Date;
  id: string;
};

/**
 * Position in the merged activity feed — one per store, not one shared.
 *
 * Decision ids are `uuid`; action ids are `manual-action-run:<uuid>` strings.
 * A shared id would be bound against a uuid column and rejected, and casting to
 * text gives three different orderings (JS UTF-16, ClickHouse UTF-8, Postgres
 * collation). Each side pages from its own last-returned row instead.
 *
 * `null` means "start from the newest" for that store.
 */
export type ActivityCursor = {
  decisions: StorePosition | null;
  actions: StorePosition | null;
};

/**
 * Serializes a {@link StorePosition} into a value the `Cursor` scalar can
 * carry — it base64+JSON-encodes whatever plain JSON value we hand it, so this
 * module only has to worry about shape, not encoding.
 */
function serializeSide(side: StorePosition | null) {
  return side === null ? null : { ts: side.ts.toISOString(), id: side.id };
}

/**
 * Builds the JSON value the `Cursor` scalar serializes into an opaque,
 * base64-encoded string. The scalar owns the base64/JSON transport; this
 * function only owns the `{ decisions, actions }` shape.
 */
export function serializeActivityCursor(cursor: ActivityCursor): JsonValue {
  return {
    decisions: serializeSide(cursor.decisions),
    actions: serializeSide(cursor.actions),
  };
}

/**
 * Validates and reconstructs an {@link ActivityCursor} from the JSON value the
 * `Cursor` scalar already decoded from base64. Opaque to callers by design —
 * the client passes back exactly what it got.
 *
 * Throws rather than treating a malformed cursor as "start from the newest",
 * so a paging bug surfaces as an error instead of looking like the reader
 * reached the top again.
 */
export function parseActivityCursor(
  value: unknown,
): ActivityCursor | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const invalid = () =>
    makeBadRequestError('Invalid activity feed cursor.', {
      shouldErrorSpan: false,
    });

  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('decisions' in value) ||
    !('actions' in value)
  ) {
    throw invalid();
  }

  const decodeSide = (side: unknown): StorePosition | null => {
    if (side === null) {
      return null;
    }
    if (
      typeof side !== 'object' ||
      !('ts' in side) ||
      !('id' in side) ||
      typeof side.ts !== 'string' ||
      typeof side.id !== 'string'
    ) {
      throw invalid();
    }
    const ts = new Date(side.ts);
    if (Number.isNaN(ts.valueOf())) {
      throw invalid();
    }
    return { ts, id: side.id };
  };

  return {
    decisions: decodeSide((value as { decisions: unknown }).decisions),
    actions: decodeSide((value as { actions: unknown }).actions),
  };
}
