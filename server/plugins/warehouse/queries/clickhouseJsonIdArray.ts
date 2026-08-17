import { jsonParse, type JsonOf } from '../../../utils/encoding.js';

/**
 * Parses a ClickHouse column holding a JSON array of `{ id, ... }` objects
 * (e.g. `policies`, `rules`). Returns `null` for empty/absent/malformed input
 * so callers can distinguish "nothing there" from "zero ids after filtering".
 */
export function parseJsonIdArray(
  jsonString: string | null | undefined,
): Array<{ id: string }> | null {
  if (!jsonString || jsonString === '[]') {
    return null;
  }
  try {
    const parsed = jsonParse(jsonString as JsonOf<unknown>);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is { id: string } =>
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          typeof item.id === 'string',
      );
    }
    return null;
  } catch {
    return null;
  }
}

/** Projects the `id` field out of {@link parseJsonIdArray}'s result. */
export function extractIds(
  values: Array<{ id: string }> | null | undefined,
): readonly string[] {
  if (!values) {
    return [];
  }
  return values
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}
