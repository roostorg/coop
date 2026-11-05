import { type JsonObject, type JsonValue } from 'type-fest';

import { makeBadRequestError } from '../../utils/errors.js';

/**
 * Position in the merged activity feed: the last row of the previous page.
 * Exactly one id is set, naming which store that row came from.
 */
export type ActivityCursor = {
  ts: Date;
  decisionId: string | null;
  actionId: string | null;
};

export function serializeActivityCursor(cursor: ActivityCursor): JsonValue {
  return {
    ts: cursor.ts.toISOString(),
    decisionId: cursor.decisionId,
    actionId: cursor.actionId,
  };
}

/** Throws on a malformed cursor rather than restarting from the newest page. */
export function parseActivityCursor(
  value: JsonValue | undefined,
): ActivityCursor | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const invalid = () =>
    makeBadRequestError('Invalid activity feed cursor.', {
      shouldErrorSpan: false,
    });

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalid();
  }
  const { ts, decisionId, actionId } = value as JsonObject;
  if (
    typeof ts !== 'string' ||
    (decisionId !== null && typeof decisionId !== 'string') ||
    (actionId !== null && typeof actionId !== 'string') ||
    (decisionId === null) === (actionId === null)
  ) {
    throw invalid();
  }
  const date = new Date(ts);
  if (Number.isNaN(date.valueOf())) {
    throw invalid();
  }
  return { ts: date, decisionId, actionId };
}
