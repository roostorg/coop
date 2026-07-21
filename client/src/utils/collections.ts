import differenceWith from 'lodash/differenceWith';
import isEqual from 'lodash/isEqual';

type Changeset<T> = {
  added: T[];
  removed: T[];
};

/**
 * Calculates the changeset of oldItems and newItems by comparing the values by
 * value, not by reference
 */
export function getChangeset<T>(oldItems: T[], newItems: T[]): Changeset<T> {
  const added = differenceWith(newItems, oldItems, isEqual);
  const removed = differenceWith(oldItems, newItems, isEqual);
  return { added, removed };
}

export function filterNullOrUndefined<T>(
  array: readonly (T | null | undefined)[],
) {
  return array.filter((it) => it !== null && it !== undefined) as T[];
}

// `Array.isArray` is typed as `arg is any[]`, which can't narrow a
// `readonly T[]` out of the union — readonly arrays aren't assignable to
// `any[]`, so they survive into the else branch and widen the return type.
function isReadonlyArray<T>(value: readonly T[] | T): value is readonly T[] {
  return Array.isArray(value);
}

export function arrayFromArrayOrSingleItem<T>(array: readonly T[] | T): T[] {
  return isReadonlyArray(array) ? [...array] : [array];
}
