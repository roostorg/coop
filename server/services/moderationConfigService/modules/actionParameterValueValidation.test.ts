import { resolveConfiguredActionParameterValues } from './actionParameterValueValidation.js';

describe('resolveConfiguredActionParameterValues', () => {
  // Mirrors the serialized shape stored in `actions.custom_mrt_api_params`.
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

  it('returns undefined when the action declares no parameters', () => {
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: null,
        rawValues: { banDays: 3 },
        actionId: 'a1',
      }),
    ).toBeUndefined();
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: [],
        rawValues: undefined,
        actionId: 'a1',
      }),
    ).toBeUndefined();
  });

  it('returns the validated values for a valid configuration', () => {
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: banDaysSpec,
        rawValues: { banDays: 30 },
        actionId: 'a1',
      }),
    ).toEqual({ banDays: 30 });
  });

  it('falls back to spec defaults when the configuration is invalid', () => {
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: banDaysSpec,
        rawValues: { banDays: 0 },
        actionId: 'a1',
      }),
    ).toEqual({ banDays: 7 });
  });

  it('applies defaults when no values are configured', () => {
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: banDaysSpec,
        rawValues: undefined,
        actionId: 'a1',
      }),
    ).toEqual({ banDays: 7 });
  });

  it('returns {} when invalid and no default can satisfy the spec', () => {
    const requiredNoDefault = [
      {
        name: 'reason',
        displayName: 'Reason',
        type: 'STRING',
        required: true,
      },
    ];
    expect(
      resolveConfiguredActionParameterValues({
        customMrtApiParams: requiredNoDefault,
        rawValues: {},
        actionId: 'a1',
      }),
    ).toEqual({});
  });
});
