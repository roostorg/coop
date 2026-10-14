import { validateConfigurationFields } from './loadPlugins.js';

describe('validateConfigurationFields', () => {
  it('returns an empty list when the manifest declares no fields', () => {
    expect(validateConfigurationFields('TEST', undefined)).toEqual([]);
  });

  it('keeps valid fields and drops unknown properties', () => {
    expect(
      validateConfigurationFields('TEST', [
        {
          key: 'apiKey',
          label: 'API key',
          required: true,
          inputType: 'password',
          description: 'Bearer token',
          extra: 'ignored',
        },
        {
          key: 'baseUrl',
          label: 'Base URL',
          required: false,
          inputType: 'text',
        },
      ]),
    ).toEqual([
      {
        key: 'apiKey',
        label: 'API key',
        required: true,
        inputType: 'password',
        description: 'Bearer token',
      },
      { key: 'baseUrl', label: 'Base URL', required: false, inputType: 'text' },
    ]);
  });

  it.each([
    [{ key: '1bad', label: 'x', required: true, inputType: 'text' }],
    [{ key: 'ok', label: '', required: true, inputType: 'text' }],
    [{ key: 'ok', label: 'x', required: 'yes', inputType: 'text' }],
    [{ key: 'ok', label: 'x', required: true, inputType: 'select' }],
  ])('rejects a malformed field %#', (field) => {
    expect(() => validateConfigurationFields('TEST', [field])).toThrow(
      'Integration "TEST" has an invalid configurationFields entry at index 0.',
    );
  });

  it('keeps select fields with valid options', () => {
    expect(
      validateConfigurationFields('TEST', [
        {
          key: 'threadContext',
          label: 'Thread context',
          required: false,
          inputType: 'select',
          options: [
            { value: 'skip', label: 'Skip' },
            { value: 'flatten', label: 'Include earlier messages' },
          ],
        },
      ]),
    ).toEqual([
      {
        key: 'threadContext',
        label: 'Thread context',
        required: false,
        inputType: 'select',
        options: [
          { value: 'skip', label: 'Skip' },
          { value: 'flatten', label: 'Include earlier messages' },
        ],
      },
    ]);
  });

  it.each([
    [undefined],
    [[]],
    [[{ value: 'a', label: '' }]],
    [
      [
        { value: 'a', label: 'A' },
        { value: 'a', label: 'Again' },
      ],
    ],
  ])('rejects select fields with bad options %#', (options) => {
    expect(() =>
      validateConfigurationFields('TEST', [
        {
          key: 'mode',
          label: 'Mode',
          required: true,
          inputType: 'select',
          options,
        },
      ]),
    ).toThrow('index 0');
  });

  it('rejects duplicate keys', () => {
    const field = {
      key: 'apiKey',
      label: 'API key',
      required: true,
      inputType: 'text',
    };
    expect(() => validateConfigurationFields('TEST', [field, field])).toThrow(
      'index 1',
    );
  });
});
