import { ReadableStream } from 'node:stream/web';

import {
  abortableAsyncIterableToArray,
  filterNullOrUndefined,
  moveArrayElement,
} from './collections.js';

describe('Collections utils functions', () => {
  describe('Filter null and undefined', () => {
    test('should leave array without nulls and undefineds unchanged', () => {
      const array = [1, 2, 3, 4];
      expect(filterNullOrUndefined(array)).toEqual(array);
    });
    test('should filter null', () => {
      const array = [1, 2, null, 3, 4];
      expect(filterNullOrUndefined(array)).toEqual([1, 2, 3, 4]);
    });
    test('should filter undefined', () => {
      const array = [1, 2, undefined, 3, 4];
      expect(filterNullOrUndefined(array)).toEqual([1, 2, 3, 4]);
    });
    test('should filter null and undefined', () => {
      const array = [1, 2, null, 3, undefined, 4];
      expect(filterNullOrUndefined(array)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Move array element', () => {
    test('Do nothing if fromIndex equals toIndex', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 1, 1)).toEqual(array);
    });
    test('Do nothing if fromIndex < 0', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, -1, 1)).toEqual(array);
    });
    test('Do nothing if toIndex < 0>', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 1, -1)).toEqual(array);
    });
    test('Do nothing if fromIndex is out of bounds', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 10, 1)).toEqual(array);
    });
    test('Do nothing if toIndex is out of bounds', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 1, 10)).toEqual(array);
    });
    test('Move element from index 0 to index 1', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 0, 1)).toEqual([2, 1, 3, 4]);
    });
    test('Move element from index 2 to index 1', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 2, 1)).toEqual([1, 3, 2, 4]);
    });
    test('Move element from index 2 to beginning of the array', () => {
      const array = [1, 2, 3, 4];
      expect(moveArrayElement(array, 2, 0)).toEqual([3, 1, 2, 4]);
    });
  });

  describe('abortableAsyncIterableToArray', () => {
    test('rejects with the abort reason when aborted during a pending read', async () => {
      const stream = new ReadableStream<number>({
        start(controller) {
          controller.enqueue(1);
        },
      });
      const deadline = new AbortController();
      const reason = new Error('deadline');

      const pending = abortableAsyncIterableToArray(stream, deadline.signal);
      await new Promise((resolve) => setImmediate(resolve));
      deadline.abort(reason);

      await expect(pending).rejects.toBe(reason);
    });

    test('stops at the limit and cancels the source', async () => {
      const cancel = vi.fn();
      const stream = new ReadableStream<number>({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
        },
        cancel,
      });

      await expect(
        abortableAsyncIterableToArray(stream, new AbortController().signal, 1),
      ).resolves.toEqual([1]);
      expect(cancel).toHaveBeenCalled();
    });

    test('returns every item when the source ends first', async () => {
      async function* numbers() {
        yield 1;
        yield 2;
      }

      await expect(
        abortableAsyncIterableToArray(numbers(), new AbortController().signal),
      ).resolves.toEqual([1, 2]);
    });

    test('removes its abort listener when the source ends first', async () => {
      async function* numbers() {
        yield 1;
      }
      const { signal } = new AbortController();
      const addEventListener = vi.spyOn(signal, 'addEventListener');
      const removeEventListener = vi.spyOn(signal, 'removeEventListener');

      await abortableAsyncIterableToArray(numbers(), signal);

      expect(removeEventListener).toHaveBeenCalledWith(
        'abort',
        addEventListener.mock.calls[0][1],
      );
    });

    test('rejects without reading when the signal is already aborted', async () => {
      const next = vi.fn();
      const source: AsyncIterable<number> = {
        [Symbol.asyncIterator]: () => ({ next }),
      };
      const reason = new Error('deadline');

      await expect(
        abortableAsyncIterableToArray(source, AbortSignal.abort(reason)),
      ).rejects.toBe(reason);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
