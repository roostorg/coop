import {
  camelCaseObjectKeysToSnakeCaseDeep,
  camelToSnakeCase,
  noPropertyValueFound,
  safeGet,
  snakeToCamelCase,
} from './misc.js';

describe('Misc utils', () => {
  describe('String inflection', () => {
    const mapping = {
      id: 'id',
      version: 'version',
      name: 'name',
      status_if_unexpired: 'statusIfUnexpired',
      tags: 'tags',
      max_daily_actions: 'maxDailyActions',
      org_id: 'orgId',
      creator_id: 'creatorId',
      expiration_time: 'expirationTime',
      condition_set: 'conditionSet',
      action_ids: 'actionIds',
      content_type_ids: 'contentTypeIds',
    } as const;

    describe('camelToSnakeCase', () => {
      test('should work for simple fields', () => {
        Object.values(mapping).forEach((v) => {
          expect(mapping[camelToSnakeCase(v)]).toEqual(v);
        });
      });
    });

    describe('snakeToCamelCase', () => {
      test('should work for simple fields', async () => {
        Object.keys(mapping).forEach((k) => {
          expect(snakeToCamelCase(k)).toEqual(
            mapping[k as keyof typeof mapping],
          );
        });
      });
    });

    describe('camelCaseObjectKeysToSnakeCaseDeep', () => {
      test('should work for simple objects', () => {
        const obj = {
          fooBar: 'value',
          nestedObj: {
            bazQux: 'value',
          },
        };

        const result = camelCaseObjectKeysToSnakeCaseDeep(obj);

        expect(result).toEqual({
          foo_bar: 'value',
          nested_obj: {
            baz_qux: 'value',
          },
        });
      });

      test('should work for arrays', () => {
        const arr = [
          { fooBar: 'value' },
          { bazQux: { valueHello: 'value' } },
        ] as const;

        const result = camelCaseObjectKeysToSnakeCaseDeep(arr);

        expect(result).toEqual([
          { foo_bar: 'value' },
          { baz_qux: { value_hello: 'value' } },
        ]);
      });
    });
  });

  describe('safeGet', () => {
    test('should short-circuit only on null/undefined/other primitives', () => {
      const c = { d: undefined, e: null };
      const a = { b: false, c };
      const dummy = { a, x: 'string' };

      expect(safeGet(dummy, ['a'])).toBe(a);
      expect(safeGet(dummy, ['a', 'b'])).toBe(false);
      expect(safeGet(dummy, ['x'])).toBe('string');

      expect(safeGet(dummy, ['a', 'y'])).toBe(noPropertyValueFound);
      expect(safeGet(dummy, ['a', 'b', 'x'])).toBe(noPropertyValueFound);
      expect(safeGet(false, ['a', 'x', 'd'])).toBe(noPropertyValueFound);

      expect(safeGet(dummy, ['a', 'c'])).toBe(c);
      expect(safeGet(false, ['a', 'c', 'd', 'e'])).toBe(noPropertyValueFound);

      expect(safeGet(false, ['a', 'c', 'f'])).toBe(noPropertyValueFound);
    });
  });
});
