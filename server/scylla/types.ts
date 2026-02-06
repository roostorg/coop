import {
  isNonEmptyString,
  type NonEmptyString,
} from '../utils/typescript-types.js';

/**
 * Scylla requires all primary key columns to be non-null when propagating rows
 * from a table into a materialized view, so instead of allowing
 * thread_identifier and parent_identifier to be null, we coerce their interal
 * properties to the empty string on insert. The NilItemIdentifier is important
 * because most of the Coop system assumes that if an ItemIdentifier exists,
 * the fields are valid, which eventually should be enforced by typing
 * ItemIdentifiers with NonEmptyString fields instead of `string`.
 *
 * Also note the slight format differences between these two types and
 * the Coop MonoRepo `ItemIdentifier` type, where the type identifier is
 * represented as `typeId`. In CQL/Scylla all column and field names end up
 * lowercase, so we stay consistent with that here by using snake casing
 * for the type_id field.
 *
 **/
export type ScyllaRealItemIdentifier = {
  id: NonEmptyString;
  type_id: NonEmptyString;
};

export type ScyllaNilItemIdentifier = typeof ScyllaNilItemIdentifier;
export const ScyllaNilItemIdentifier = { id: '', type_id: '' } as const;

export type ScyllaItemIdentifier =
  | ScyllaRealItemIdentifier
  | ScyllaNilItemIdentifier;

export function isRealItemIdentifier(
  it: ScyllaItemIdentifier,
): it is ScyllaRealItemIdentifier {
  return isNonEmptyString(it.id) && isNonEmptyString(it.type_id);
}
