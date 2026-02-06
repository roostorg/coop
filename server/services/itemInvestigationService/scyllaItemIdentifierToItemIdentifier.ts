import type { ScyllaItemIdentifier } from '../../scylla/types.js';
import { tryParseNonEmptyString } from '../../utils/typescript-types.js';

export function scyllaItemIdentifierToItemIdentifier(it: ScyllaItemIdentifier) {
  return {
    id: tryParseNonEmptyString(it.id),
    typeId: tryParseNonEmptyString(it.type_id),
  };
}
