import { validateActionParameters } from './actionParametersValidation.js';

describe('validateActionParameters', () => {
  it('returns an empty array for null/undefined/empty', () => {
    expect(validateActionParameters(null)).toEqual([]);
    expect(validateActionParameters(undefined)).toEqual([]);
    expect(validateActionParameters([])).toEqual([]);
  });

  it('accepts a well-formed STRING parameter', () => {
    const params = validateActionParameters([
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'STRING',
        required: true,
        maxLength: 500,
      },
    ]);
    expect(params).toHaveLength(1);
    expect(params[0]?.type).toBe('STRING');
  });

  it('accepts NUMBER with min/max and default in range', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'days',
          displayName: 'Days',
          type: 'NUMBER',
          required: false,
          min: 1,
          max: 30,
          defaultValue: 7,
        },
      ]),
    ).not.toThrow();
  });

  it('rejects NUMBER with default below min', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'days',
          displayName: 'Days',
          type: 'NUMBER',
          required: false,
          min: 5,
          defaultValue: 1,
        },
      ]),
    ).toThrow(/below min/);
  });

  it('rejects NUMBER with min > max', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'days',
          displayName: 'Days',
          type: 'NUMBER',
          required: false,
          min: 10,
          max: 5,
        },
      ]),
    ).toThrow(/min.*<=.*max/);
  });

  it('rejects names with whitespace, quotes, or brackets', () => {
    for (const name of ['has spaces', 'q"uote', 'bracket[0]', 'paren(x)']) {
      expect(() =>
        validateActionParameters([
          { name, displayName: 'Bad', type: 'STRING', required: false },
        ]),
      ).toThrow();
    }
  });

  it('accepts snake_case, kebab-case, and dotted names', () => {
    for (const name of ['ban_duration', 'ban-duration', 'org.user.id', 'a.b-c_1']) {
      expect(() =>
        validateActionParameters([
          { name, displayName: 'OK', type: 'STRING', required: false },
        ]),
      ).not.toThrow();
    }
  });

  it('rejects duplicate names', () => {
    expect(() =>
      validateActionParameters([
        { name: 'a', displayName: 'A', type: 'STRING', required: false },
        { name: 'a', displayName: 'A2', type: 'STRING', required: false },
      ]),
    ).toThrow(/duplicated/);
  });

  it('requires options for SELECT and MULTISELECT', () => {
    expect(() =>
      validateActionParameters([
        { name: 'x', displayName: 'X', type: 'SELECT', required: false },
      ]),
    ).toThrow(/required for SELECT/);
    expect(() =>
      validateActionParameters([
        {
          name: 'x',
          displayName: 'X',
          type: 'MULTISELECT',
          required: false,
        },
      ]),
    ).toThrow(/required for MULTISELECT/);
  });

  it('rejects SELECT default that is not in options', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'reason',
          displayName: 'Reason',
          type: 'SELECT',
          required: false,
          options: [{ value: 'spam', label: 'Spam' }],
          defaultValue: 'abuse',
        },
      ]),
    ).toThrow(/option values/);
  });

  it('accepts MULTISELECT default as an array of option values', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'tags',
          displayName: 'Tags',
          type: 'MULTISELECT',
          required: false,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
          defaultValue: ['a', 'b'],
        },
      ]),
    ).not.toThrow();
  });

  it('rejects type-incompatible defaultValue', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'x',
          displayName: 'X',
          type: 'STRING',
          required: false,
          defaultValue: 123,
        },
      ]),
    ).toThrow(/string for STRING/);
    expect(() =>
      validateActionParameters([
        {
          name: 'x',
          displayName: 'X',
          type: 'BOOLEAN',
          required: false,
          defaultValue: 'true',
        },
      ]),
    ).toThrow(/boolean for BOOLEAN/);
  });

  it('rejects unknown top-level fields (additionalProperties)', () => {
    expect(() =>
      validateActionParameters([
        {
          name: 'x',
          displayName: 'X',
          type: 'STRING',
          required: false,
          surprise: 'value',
        },
      ]),
    ).toThrow();
  });
});
