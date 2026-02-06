/**
 * Takes an async iterable, and yields its values in (asynchronously available)
 * chunks. The last chunk may be smaller than chunkSize, if the iterable doesn't
 * contain an even multiple of `chunkSize` items.
 */
export async function* chunkAsyncIterableBySize<T>(
  chunkSize: number,
  it: AsyncIterable<T> | Iterable<T>,
) {
  if (chunkSize < 1 || !Number.isInteger(chunkSize)) {
    throw new Error('chunkSize must be an integer >= 1');
  }

  let thisChunk: Awaited<T>[] = [];
  for await (const item of it) {
    thisChunk.push(item);
    if (thisChunk.length === chunkSize) {
      yield thisChunk;
      thisChunk = [];
    }
  }

  if (thisChunk.length) {
    yield thisChunk;
  }
}

/**
 * Takes an async iterable, and yields its values in (asynchronously available)
 * chunks grouped by matching keys. This function assumes the underlying source
 * has the data sorted by the given key, otherwise this function can produce
 * multiple chunks that have the same key
 */
export async function* chunkAsyncIterableByKey<T, K>(
  stream: AsyncIterable<T>,
  keyFn: (item: T) => K,
): AsyncGenerator<T[]> {
  let chunk: T[] = [];
  let currentKey: K | null = null;
  let isKeyInitialized = false;

  for await (const item of stream) {
    const newKey = keyFn(item);

    if (!isKeyInitialized) {
      chunk = [item];
      currentKey = newKey;
      isKeyInitialized = true;
    } else if (currentKey === newKey) {
      chunk.push(item);
    } else {
      // If the key changes, emit the current chunk
      if (chunk.length > 0) {
        yield chunk;
      }

      // Start a new chunk with the current item and update the current key
      chunk = [item];
      currentKey = newKey;
    }
  }

  // Emit any remaining items as a chunk
  if (chunk.length > 0) {
    yield chunk;
  }
}

export async function* mapAsyncIterable<OriginalItem, MappedItem>(
  this: void,
  iterable: AsyncIterable<OriginalItem> | Iterable<OriginalItem>,
  mapFn: (it: OriginalItem) => MappedItem | Promise<MappedItem>,
): AsyncIterable<MappedItem> {
  for await (const item of iterable) {
    yield await mapFn(item);
  }
}

/**
 * A version of {@link mapAsyncIterable} designed to support partial application
 * of the mapping function.
 */
export function makeMapAsyncIterable<OriginalItem, MappedItem>(
  mapFn: (it: OriginalItem) => MappedItem | Promise<MappedItem>,
) {
  return async function* (
    iterable: AsyncIterable<OriginalItem> | Iterable<OriginalItem>,
  ) {
    yield* mapAsyncIterable(iterable, mapFn);
  };
}
