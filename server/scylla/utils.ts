import type { ItemIdentifier } from '@roostorg/types';

import { tryParseNonEmptyString } from '../utils/typescript-types.js';
import type {
  ScyllaItemIdentifier,
  ScyllaRealItemIdentifier,
} from './types.js';

export function scyllaItemIdentifierToItemIdentifier(it: ScyllaItemIdentifier) {
  return {
    id: tryParseNonEmptyString(it.id),
    typeId: tryParseNonEmptyString(it.type_id),
  };
}

/**
 * NB: This will throw if the item identifier is 'invalid' in the sense of
 * containing empty strings for any of its components. ItemIdentifiers are
 * expected to always contain non-empty strings -- even though, strictly
 * speaking, we haven't yet updated ItemIdentifier to bake in that requirement
 * or communicated it to users.
 */
export function itemIdentifierToScyllaItemIdentifier(
  it: ItemIdentifier,
): ScyllaRealItemIdentifier {
  return {
    id: tryParseNonEmptyString(it.id),
    type_id: tryParseNonEmptyString(it.typeId),
  };
}
