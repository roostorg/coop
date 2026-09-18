import { hostList, integer } from './validators.js';

describe('integer env validator', () => {
  describe('integer', () => {
    const validate = integer();

    test('accepts any integer, including zero and negatives', () => {
      expect(validate('SOME_VAR', '10')).toBe(10);
      expect(validate('SOME_VAR', '0')).toBe(0);
      expect(validate('SOME_VAR', '-3')).toBe(-3);
    });

    // `Env.schema.number` accepts this, because `Number('1.5')` is not NaN.
    test('rejects floats', () => {
      expect(() => validate('SOME_VAR', '1.5')).toThrow();
    });

    // The retired helpers used `parseInt`, which read this as 12.
    test('rejects a numeric prefix followed by junk', () => {
      expect(() => validate('SOME_VAR', '12abc')).toThrow();
    });

    test('rejects a missing or empty value', () => {
      expect(() => validate('SOME_VAR', undefined)).toThrow();
      expect(() => validate('SOME_VAR', '')).toThrow();
    });

    test('names the variable and the offending value', () => {
      expect(() => validate('SOME_VAR', '1.5')).toThrow(/SOME_VAR/);
      expect(() => validate('SOME_VAR', '1.5')).toThrow(/1\.5/);
    });
  });

  describe('integer.positive', () => {
    const validate = integer.positive();

    test('accepts an integer greater than zero', () => {
      expect(validate('SOME_VAR', '7')).toBe(7);
    });

    test('rejects zero and negatives', () => {
      expect(() => validate('SOME_VAR', '0')).toThrow();
      expect(() => validate('SOME_VAR', '-5')).toThrow();
    });
  });

  describe('integer.nonNegative', () => {
    const validate = integer.nonNegative();

    test('accepts zero, since zero is meaningful for retries and timeouts', () => {
      expect(validate('SOME_VAR', '0')).toBe(0);
    });

    test('rejects negatives and floats', () => {
      expect(() => validate('SOME_VAR', '-1')).toThrow();
      expect(() => validate('SOME_VAR', '0.5')).toThrow();
    });
  });

  describe('.optional()', () => {
    test('returns undefined when unset or empty', () => {
      expect(
        integer.positive.optional()('SOME_VAR', undefined),
      ).toBeUndefined();
      expect(integer.positive.optional()('SOME_VAR', '')).toBeUndefined();
    });

    test('still validates a value that is present', () => {
      expect(integer.positive.optional()('SOME_VAR', '3')).toBe(3);
      expect(() => integer.positive.optional()('SOME_VAR', '0')).toThrow();
    });

    // An empty value is absent, so the consumer's default applies rather than
    // the feature being silently disabled by a zero.
    test('treats an empty value as absent rather than zero', () => {
      expect(integer.nonNegative.optional()('SOME_VAR', '')).toBeUndefined();
      expect(integer.nonNegative.optional()('SOME_VAR', '0')).toBe(0);
    });
  });
});

describe('hostList env validator', () => {
  const validate = hostList();

  // The three shipped env files between them use all of these forms.
  test('accepts a bare hostname, an IP, and a host with a port', () => {
    expect(validate('SCYLLA_HOSTS', 'scylla')).toEqual(['scylla']);
    expect(validate('SCYLLA_HOSTS', '127.0.0.1')).toEqual(['127.0.0.1']);
    expect(validate('SCYLLA_HOSTS', '127.0.0.1:9042')).toEqual([
      '127.0.0.1:9042',
    ]);
  });

  test('splits a comma-separated list and trims each entry', () => {
    expect(validate('SCYLLA_HOSTS', 'db1, db2 ,db3:9043')).toEqual([
      'db1',
      'db2',
      'db3:9043',
    ]);
  });

  test('ignores empty entries from stray commas', () => {
    expect(validate('SCYLLA_HOSTS', 'db1,,db2,')).toEqual(['db1', 'db2']);
  });

  // This is what the old post-validation block existed to catch.
  test('rejects a value that contains no hosts at all', () => {
    expect(() => validate('SCYLLA_HOSTS', ',')).toThrow(/SCYLLA_HOSTS/);
    expect(() => validate('SCYLLA_HOSTS', ' , , ')).toThrow();
  });

  test('rejects an unset or empty value', () => {
    expect(() => validate('SCYLLA_HOSTS', undefined)).toThrow();
    expect(() => validate('SCYLLA_HOSTS', '')).toThrow();
  });

  test('rejects an invalid host', () => {
    expect(() => validate('SCYLLA_HOSTS', 'not a host')).toThrow();
    expect(() => validate('SCYLLA_HOSTS', 'db1,not a host')).toThrow();
  });

  test('rejects an out-of-range or non-numeric port', () => {
    expect(() => validate('SCYLLA_HOSTS', 'db1:0')).toThrow();
    expect(() => validate('SCYLLA_HOSTS', 'db1:70000')).toThrow();
    expect(() => validate('SCYLLA_HOSTS', 'db1:abc')).toThrow();
  });

  describe('.optional()', () => {
    test('returns undefined when unset, since Scylla itself is optional', () => {
      expect(hostList.optional()('SCYLLA_HOSTS', undefined)).toBeUndefined();
      expect(hostList.optional()('SCYLLA_HOSTS', '')).toBeUndefined();
    });

    test('still validates a value that is present', () => {
      expect(hostList.optional()('SCYLLA_HOSTS', 'db1')).toEqual(['db1']);
      expect(() => hostList.optional()('SCYLLA_HOSTS', ',')).toThrow();
    });
  });

  describe('.optionalWhen()', () => {
    test('is required when the condition is false', () => {
      expect(() =>
        hostList.optionalWhen(false)('SCYLLA_HOSTS', undefined),
      ).toThrow();
      expect(hostList.optionalWhen(false)('SCYLLA_HOSTS', 'db1')).toEqual([
        'db1',
      ]);
    });

    test('is optional when the condition is true', () => {
      expect(
        hostList.optionalWhen(true)('SCYLLA_HOSTS', undefined),
      ).toBeUndefined();
    });

    test('still validates a value that is present, even when optional', () => {
      expect(() => hostList.optionalWhen(true)('SCYLLA_HOSTS', ',')).toThrow();
    });

    test('evaluates a function condition at validation time, not schema build time', () => {
      let disabled = false;
      const validate = hostList.optionalWhen(() => disabled);

      expect(() => validate('SCYLLA_HOSTS', undefined)).toThrow();

      // The condition is re-read on each call, which is what lets it depend on
      // a sibling variable that `Env.create` only puts in `process.env` after
      // the schema object has been built.
      disabled = true;
      expect(validate('SCYLLA_HOSTS', undefined)).toBeUndefined();
    });

    test('passes the key and value through to a function condition', () => {
      const condition = jest.fn(() => true);
      hostList.optionalWhen(condition)('SCYLLA_HOSTS', 'db1');
      expect(condition).toHaveBeenCalledWith('SCYLLA_HOSTS', 'db1');
    });
  });
});
