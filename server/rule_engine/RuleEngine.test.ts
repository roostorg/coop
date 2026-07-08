import { resolveConfiguredParametersByActionId } from './RuleEngine.js';

// Mirrors the serialized spec stored in `actions.custom_mrt_api_params`.
const banDaysSpec = [
  {
    name: 'banDays',
    displayName: 'Ban days',
    type: 'NUMBER',
    required: true,
    min: 1,
    defaultValue: 7,
  },
];

function customAction(id: string, customMrtApiParams: unknown) {
  return { id, actionType: 'CUSTOM_ACTION', customMrtApiParams };
}

describe('resolveConfiguredParametersByActionId', () => {
  it('resolves configured values for a parameterized action', () => {
    const result = resolveConfiguredParametersByActionId([
      [
        {
          action: customAction('a1', banDaysSpec),
          parameters: { banDays: 30 },
        },
      ],
    ]);
    expect(Object.fromEntries(result)).toEqual({ a1: { banDays: 30 } });
  });

  it('keeps the first non-empty configuration when an action is shared across rules', () => {
    const result = resolveConfiguredParametersByActionId([
      // Rule 1 attaches a1 with banDays=30.
      [
        {
          action: customAction('a1', banDaysSpec),
          parameters: { banDays: 30 },
        },
      ],
      // Rule 2 attaches the same a1 with banDays=1; deduped, so it's ignored.
      [{ action: customAction('a1', banDaysSpec), parameters: { banDays: 1 } }],
    ]);
    expect(Object.fromEntries(result)).toEqual({ a1: { banDays: 30 } });
  });

  it('falls back to spec defaults when the configured value is invalid', () => {
    const result = resolveConfiguredParametersByActionId([
      [{ action: customAction('a1', banDaysSpec), parameters: { banDays: 0 } }],
    ]);
    expect(Object.fromEntries(result)).toEqual({ a1: { banDays: 7 } });
  });

  it('omits actions that declare no parameters', () => {
    const result = resolveConfiguredParametersByActionId([
      [
        { action: customAction('a1', null), parameters: {} },
        {
          action: { id: 'a2', actionType: 'ENQUEUE_TO_MRT' },
          parameters: { banDays: 30 },
        },
      ],
    ]);
    expect(result.size).toBe(0);
  });
});
