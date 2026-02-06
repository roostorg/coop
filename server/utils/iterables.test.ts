import {
  chunkAsyncIterableByKey,
  chunkAsyncIterableBySize,
} from './iterables.js';

describe('Iterable utils', () => {
  describe('chunkAsyncIterableBySize', () => {
    test('should yield chunks of proper size, except for the last chunk, which should hold the remaining items', async () => {
      async function* foo() {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
      }

      const chunkedIterable = chunkAsyncIterableBySize(2, foo());
      await chunkedIterable.next().then(({ value, done }) => {
        expect(value).toEqual([1, 2]);
        expect(done).toEqual(false);
      });
      await chunkedIterable.next().then(({ value, done }) => {
        expect(value).toEqual([3, 4]);
        expect(done).toEqual(false);
      });
      await chunkedIterable.next().then(({ value, done }) => {
        expect(value).toEqual([5]);
        expect(done).toEqual(false);
      });
      await chunkedIterable.next().then(({ value, done }) => {
        expect(value).toEqual(undefined);
        expect(done).toEqual(true);
      });
    });
  });
});

describe('chunkAsyncIterableByKey', () => {
  it('should chunk numbers based on even and odd', async () => {
    async function* sampleStream() {
      // eslint-disable-next-line better-mutation/no-mutation
      for (let i = 1; i <= 5; i++) {
        yield i;
        yield i;
      }
    }

    const result: number[][] = [];
    for await (const chunk of chunkAsyncIterableByKey(
      sampleStream(),
      (item) => item % 2 === 0,
    )) {
      result.push(chunk);
    }

    expect(result).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ]);
  });

  it('should handle an empty stream', async () => {
    async function* emptyStream() {}

    const result: number[][] = [];
    for await (const chunk of chunkAsyncIterableByKey(
      emptyStream(),
      (it) => it,
    )) {
      result.push(chunk);
    }

    expect(result).toEqual([]);
  });

  it('should handle undefined as a valid key', async () => {
    async function* sampleStream() {
      yield 1;
      yield undefined;
      yield 1;
    }

    const chunkKey = (item: number | undefined) => item;

    const result: (number | undefined)[][] = [];
    for await (const chunk of chunkAsyncIterableByKey(
      sampleStream(),
      chunkKey,
    )) {
      result.push(chunk);
    }

    expect(result).toEqual([[1], [undefined], [1]]);
  });
});
