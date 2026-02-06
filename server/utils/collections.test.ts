import { filterNullOrUndefined, moveArrayElement } from './collections.js';

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
});
