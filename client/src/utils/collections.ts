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

export function arrayFromArrayOrSingleItem<T>(array: readonly T[] | T): T[] {
  return Array.isArray(array) ? [...array] : [array];
}
