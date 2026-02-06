import { setTimeout as setTimeoutPromise } from 'node:timers/promises';

export function filterNullOrUndefined<T>(
  array: T[],
): Exclude<T, null | undefined>[];
export function filterNullOrUndefined<T>(
  array: readonly T[],
): readonly Exclude<T, null | undefined>[];
export function filterNullOrUndefined<T>(array: readonly T[]) {
  return array.filter(
    (it): it is Exclude<T, null | undefined> => it !== null && it !== undefined,
  );
}

export function moveArrayElement<T>(
  array: T[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length
  ) {
    return array.slice();
  }

  const element = array[fromIndex]; // Get the element at the original index
  const newArray = array.slice(0, fromIndex).concat(array.slice(fromIndex + 1)); // Remove the element from the original index
  newArray.splice(toIndex, 0, element); // Insert the element at the new index
  return newArray;
}

export async function asyncIterableToArray<T>(
  it: AsyncIterable<T>,
): Promise<T[]> {
  const result = [];
  for await (const x of it) {
    result.push(x);
  }
  return result;
}

/**
 * Gets an iterator from the given iterable and iterates it until the timeout is
 * hit, at which point it returns an array of all the items that have been
 * yielded up until that moment. When the timeout is hit, it also calls return()
 * on the iterator to signal disinterest in further consumption.
 */
export async function asyncIterableToArrayWithTimeout<T>(
  it: AsyncIterable<T>,
  timeoutMs: number,
): Promise<T[]> {
  const items: T[] = [];
  let timeoutReached = false;

  const timeoutPromise = setTimeoutPromise(timeoutMs).then(() => {
    timeoutReached = true;
  });

  const itemsIterationPromise = (async () => {
    for await (const item of it) {
      items.push(item);

      // Once timeout's reached, stop awaiting more items. This will implicitly
      // call iterator.return() to let the iterator know we're done consuming.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (timeoutReached) {
        break;
      }
    }
  })();

  await Promise.race([timeoutPromise, itemsIterationPromise]);
  return items;
}

/**
 * Same as above, except this function also takes a limit to the number of items
 * the caller wants, and returns as soon as that limit is reached.
 */
export async function asyncIterableToArrayWithTimeoutAndLimit<T>(
  it: AsyncIterable<T>,
  timeoutMs: number,
  limit: number,
): Promise<T[]> {
  const items: T[] = [];
  let timeoutReached = false;

  const timeoutPromise = setTimeoutPromise(timeoutMs).then(() => {
    timeoutReached = true;
  });

  const itemsIterationPromise = (async () => {
    for await (const item of it) {
      items.push(item);

      // Once timeout's reached or the limit is reached, stop awaiting more items. This will implicitly
      // call iterator.return() to let the iterator know we're done consuming.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (timeoutReached || items.length >= limit) {
        break;
      }
    }
  })();

  await Promise.race([timeoutPromise, itemsIterationPromise]);
  return items;
}
