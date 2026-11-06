import {
  camelCaseObjectKeysToSnakeCaseDeep,
  camelToSnakeCase,
  getOwn,
  noPropertyValueFound,
  patchInPlace,
  safeGet,
  setOwn,
  snakeToCamelCase,
} from './misc.js';

describe('Misc utils', () => {
  describe('own-property access', () => {
    test('reads own values without falling back to the prototype', () => {
      const inheritedGetter = vi.fn(() => 'inherited');
      const prototype = Object.defineProperty({}, 'secret', {
        get: inheritedGetter,
      });
      const object: Record<string, unknown> = Object.create(prototype, {
        value: { value: 0 },
        empty: { value: undefined },
      });

      expect(getOwn(object, 'value')).toBe(0);
      expect(getOwn(object, 'empty')).toBeUndefined();
      expect(getOwn(object, 'missing')).toBeUndefined();
      expect(getOwn(object, 'constructor')).toBeUndefined();
      expect(getOwn(object, '__proto__')).toBeUndefined();
      expect(getOwn(object, 'secret')).toBeUndefined();
      expect(inheritedGetter).not.toHaveBeenCalled();
      expect(getOwn(null, 'value')).toBeUndefined();
      expect(getOwn(undefined, 'value')).toBeUndefined();
    });

    test('writes ordinary own properties without changing the prototype or invoking setters', () => {
      const inheritedSetter = vi.fn();
      const prototype = Object.defineProperty({}, 'secret', {
        set: inheritedSetter,
      });
      const object: Record<string, unknown> = Object.create(prototype);
      const value = { marker: true };

      for (const key of ['__proto__', 'constructor', 'secret']) {
        setOwn(object, key, value);
        expect(Object.hasOwn(object, key)).toBe(true);
        expect(getOwn(object, key)).toBe(value);
      }
      expect(Object.getPrototypeOf(object)).toBe(prototype);
      expect(inheritedSetter).not.toHaveBeenCalled();
      expect(Object.keys(object)).toEqual([
        '__proto__',
        'constructor',
        'secret',
      ]);

      setOwn(object, 'secret', false);
      expect(getOwn(object, 'secret')).toBe(false);
    });

    test.each([
      { writable: true, enumerable: false, configurable: false },
      { writable: true, enumerable: false, configurable: true },
      { writable: false, enumerable: true, configurable: true },
    ])('preserves existing data-property attributes: %j', (attributes) => {
      const object: Record<string, number> = Object.defineProperty(
        {},
        'value',
        {
          value: 1,
          ...attributes,
        },
      );

      setOwn(object, 'value', 2);

      expect(Object.getOwnPropertyDescriptor(object, 'value')).toEqual({
        value: 2,
        ...attributes,
      });
    });

    test('patches own values, including prototype-like keys, and skips undefined', () => {
      const object: Record<string, unknown> = { keep: 1, replace: 2 };
      const patch = Object.fromEntries([
        ['__proto__', { marker: true }],
        ['keep', undefined],
        ['replace', 3],
      ]);

      patchInPlace(object, patch);

      expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
      expect(getOwn(object, '__proto__')).toEqual({ marker: true });
      expect(object.keep).toBe(1);
      expect(object.replace).toBe(3);
    });
  });

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
    test('does not traverse inherited properties at any depth', () => {
      const inheritedGetter = vi.fn(() => ({ value: 'inherited' }));
      const prototype = Object.defineProperty({}, 'secret', {
        get: inheritedGetter,
      });
      const dictionary = Object.create(prototype);

      for (const key of ['constructor', '__proto__', 'secret']) {
        expect(safeGet(dictionary, [key])).toBe(noPropertyValueFound);
        expect(safeGet({ nested: dictionary }, ['nested', key])).toBe(
          noPropertyValueFound,
        );
        expect(safeGet({ nested: dictionary }, ['nested', key, 'value'])).toBe(
          noPropertyValueFound,
        );
      }
      expect(inheritedGetter).not.toHaveBeenCalled();

      const own = Object.fromEntries([['__proto__', { value: 42 }]]);
      expect(safeGet(own, ['__proto__', 'value'])).toBe(42);
    });

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
      expect(safeGet(dummy, ['a', 'c', 'd'])).toBeUndefined();
      expect(safeGet(dummy, ['a', 'c', 'e'])).toBeNull();
      expect(safeGet(dummy, ['a', 'c', 'f'])).toBe(noPropertyValueFound);
      expect(safeGet(false, ['a', 'c', 'd', 'e'])).toBe(noPropertyValueFound);

      expect(safeGet(false, ['a', 'c', 'f'])).toBe(noPropertyValueFound);
    });
  });
});
