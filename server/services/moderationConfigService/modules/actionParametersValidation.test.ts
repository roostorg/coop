import {
  parseStoredParameters,
  validateActionParameters,
} from './actionParametersValidation.js';
import { validateActionParameterValues } from './actionParameterValueValidation.js';

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
    for (const name of [
      'ban_duration',
      'ban-duration',
      'org.user.id',
      'a.b-c_1',
    ]) {
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

  describe('rejects "empty" defaultValue when the parameter is required', () => {
    it('STRING with empty default', () => {
      expect(() =>
        validateActionParameters([
          {
            name: 'x',
            displayName: 'X',
            type: 'STRING',
            required: true,
            defaultValue: '',
          },
        ]),
      ).toThrow(/cannot be empty when the parameter is required/);
    });

    it('STRING with whitespace-only default', () => {
      expect(() =>
        validateActionParameters([
          {
            name: 'x',
            displayName: 'X',
            type: 'STRING',
            required: true,
            defaultValue: '   ',
          },
        ]),
      ).toThrow(/cannot be empty when the parameter is required/);
    });

    it('MULTISELECT with empty array default', () => {
      expect(() =>
        validateActionParameters([
          {
            name: 'tags',
            displayName: 'Tags',
            type: 'MULTISELECT',
            required: true,
            options: [{ value: 'a', label: 'A' }],
            defaultValue: [],
          },
        ]),
      ).toThrow(/cannot be empty when the parameter is required/);
    });
  });
});

describe('parseStoredParameters', () => {
  it('returns [] for null/undefined/empty/non-arrays', () => {
    expect(parseStoredParameters(null)).toEqual([]);
    expect(parseStoredParameters(undefined)).toEqual([]);
    expect(parseStoredParameters([])).toEqual([]);
    expect(parseStoredParameters('not an array')).toEqual([]);
  });

  it('round-trips a well-formed list', () => {
    const stored = [
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'SELECT',
        required: true,
        options: [{ value: 'spam', label: 'Spam' }],
      },
    ];
    const parsed = parseStoredParameters(stored);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('SELECT');
    expect(parsed[0]?.options).toEqual([{ value: 'spam', label: 'Spam' }]);
  });

  it('skips entries with unknown type or missing required keys (defensive)', () => {
    const stored = [
      // Valid
      { name: 'a', displayName: 'A', type: 'STRING', required: false },
      // Missing displayName
      { name: 'b', type: 'STRING', required: false },
      // Unknown type
      { name: 'c', displayName: 'C', type: 'WHATEVER', required: false },
      // Not an object
      'garbage',
      null,
    ];
    expect(parseStoredParameters(stored)).toHaveLength(1);
  });
});

describe('validateActionParameterValues', () => {
  const spec = [
    {
      name: 'days',
      displayName: 'Days',
      type: 'NUMBER' as const,
      required: true,
      min: 1,
      max: 365,
    },
    {
      name: 'reason',
      displayName: 'Reason',
      type: 'SELECT' as const,
      required: true,
      options: [
        { value: 'spam', label: 'Spam' },
        { value: 'abuse', label: 'Abuse' },
      ],
    },
    {
      name: 'silent',
      displayName: 'Silent',
      type: 'BOOLEAN' as const,
      required: false,
      defaultValue: false,
    },
  ];

  it('accepts a complete, well-typed value map', () => {
    const out = validateActionParameterValues(spec, {
      days: 7,
      reason: 'spam',
      silent: true,
    });
    expect(out).toEqual({ days: 7, reason: 'spam', silent: true });
  });

  it('applies defaults for omitted optional parameters', () => {
    const out = validateActionParameterValues(spec, {
      days: 1,
      reason: 'abuse',
    });
    expect(out.silent).toBe(false);
  });

  it('rejects missing required parameters', () => {
    expect(() =>
      validateActionParameterValues(spec, { reason: 'spam' }),
    ).toThrow(/required/);
  });

  it('rejects values that violate per-type rules', () => {
    expect(() =>
      validateActionParameterValues(spec, { days: 9999, reason: 'spam' }),
    ).toThrow(/above max/);
    expect(() =>
      validateActionParameterValues(spec, { days: 1, reason: 'unknown' }),
    ).toThrow(/option values/);
  });

  it('rejects unknown keys not declared in the spec', () => {
    expect(() =>
      validateActionParameterValues(spec, {
        days: 1,
        reason: 'spam',
        sneaky: 'value',
      }),
    ).toThrow(/Unknown parameter/);
  });

  it('returns an empty object for empty spec and empty values', () => {
    expect(validateActionParameterValues([], {})).toEqual({});
    expect(validateActionParameterValues([], null)).toEqual({});
  });

  it('makes a defensive copy of MULTISELECT arrays', () => {
    const multi = [
      {
        name: 'tags',
        displayName: 'Tags',
        type: 'MULTISELECT' as const,
        required: true,
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    ];
    const input = ['a', 'b'];
    const out = validateActionParameterValues(multi, { tags: input });
    expect(out.tags).toEqual(['a', 'b']);
    expect(out.tags).not.toBe(input);
  });

  describe('strict required-field semantics', () => {
    const stringSpec = [
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'STRING' as const,
        required: true,
      },
    ];
    const selectSpec = [
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'SELECT' as const,
        required: true,
        options: [{ value: 'spam', label: 'Spam' }],
      },
    ];
    const multiSpec = [
      {
        name: 'tags',
        displayName: 'Tags',
        type: 'MULTISELECT' as const,
        required: true,
        options: [{ value: 'a', label: 'A' }],
      },
    ];

    it('treats empty STRING as missing for required parameters', () => {
      expect(() =>
        validateActionParameterValues(stringSpec, { reason: '' }),
      ).toThrow(/required/);
    });

    it('treats whitespace-only STRING as missing for required parameters', () => {
      expect(() =>
        validateActionParameterValues(stringSpec, { reason: '   ' }),
      ).toThrow(/required/);
    });

    it('treats empty MULTISELECT array as missing for required parameters', () => {
      expect(() =>
        validateActionParameterValues(multiSpec, { tags: [] }),
      ).toThrow(/required/);
    });

    it('rejects null for required parameters', () => {
      expect(() =>
        validateActionParameterValues(stringSpec, { reason: null }),
      ).toThrow(/required/);
    });

    it('rejects empty SELECT string against the option allowlist', () => {
      expect(() =>
        validateActionParameterValues(selectSpec, { reason: '' }),
      ).toThrow(/required/);
    });

    it('keeps NUMBER 0 valid for required parameters', () => {
      const spec = [
        {
          name: 'count',
          displayName: 'Count',
          type: 'NUMBER' as const,
          required: true,
        },
      ];
      expect(validateActionParameterValues(spec, { count: 0 })).toEqual({
        count: 0,
      });
    });

    it('keeps BOOLEAN false valid for required parameters', () => {
      const spec = [
        {
          name: 'flag',
          displayName: 'Flag',
          type: 'BOOLEAN' as const,
          required: true,
        },
      ];
      expect(validateActionParameterValues(spec, { flag: false })).toEqual({
        flag: false,
      });
    });
  });

  describe('top-level shape validation', () => {
    it('rejects an array as the parameter map', () => {
      expect(() => validateActionParameterValues([], [])).toThrow(
        /plain object/,
      );
    });

    it('rejects a primitive as the parameter map', () => {
      expect(() => validateActionParameterValues([], 'string')).toThrow(
        /plain object/,
      );
    });

    it('accepts null and undefined (treated as no values supplied)', () => {
      expect(validateActionParameterValues([], null)).toEqual({});
      expect(validateActionParameterValues([], undefined)).toEqual({});
    });
  });
});
