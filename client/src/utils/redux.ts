/**
 * Returns a copy of the given array with the given index's item removed.
 */
export function arrayWithout<T>(arr: readonly T[], index: number) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

/**
 * Returns a copy of the given array with the given item inserted at the given
 * index.
 */
export function arrayWith<T>(arr: readonly T[], item: T, index: number) {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1)];
}
