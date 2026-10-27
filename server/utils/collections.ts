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
 * Collects items from the iterable until it ends or `limit` items have been
 * collected. If `signal` aborts first, rejects with `signal.reason` and
 * discards whatever was collected.
 *
 * Aborting only stops this function from waiting. A `for await` loop cannot
 * call `return()` while a `next()` is still pending, so the source must also
 * observe `signal` and end its iteration, or its pending read stays open.
 */
export async function abortableAsyncIterableToArray<T>(
  it: AsyncIterable<T>,
  signal: AbortSignal,
  limit = Infinity,
): Promise<T[]> {
  signal.throwIfAborted();

  let onAbort = () => {};
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  const itemsIterationPromise = (async () => {
    const items: T[] = [];
    for await (const item of it) {
      // Breaking calls iterator.return() to let the iterator know we're done
      // consuming.
      if (signal.aborted) {
        break;
      }
      items.push(item);
      if (items.length >= limit) {
        break;
      }
    }
    return items;
  })();
  // The source can still reject after the abort has won the race.
  itemsIterationPromise.catch(() => undefined);

  try {
    return await Promise.race([abortPromise, itemsIterationPromise]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
