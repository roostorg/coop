import { validateConfigurationFields } from './loadPlugins.js';

const MAX_FIELDS = 50;

function textField(key: string) {
  return { key, label: 'Field', required: false, inputType: 'text' };
}

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

  it.each([[null], [{}], [new Array(MAX_FIELDS + 1).fill(textField('a'))]])(
    'rejects a configurationFields value that is not a list of at most 50 fields %#',
    (value) => {
      expect(() => validateConfigurationFields('TEST', value)).toThrow(
        'configurationFields must be an array of at most 50 fields',
      );
    },
  );

  it('rejects holes in a sparse field list', () => {
    expect(() => validateConfigurationFields('TEST', new Array(1))).toThrow(
      'index 0',
    );
  });

  it.each([
    [{ key: '1bad', label: 'x', required: true, inputType: 'text' }],
    [{ key: 'ok', label: '', required: true, inputType: 'text' }],
    [{ key: 'ok', label: 'x', required: 'yes', inputType: 'text' }],
    [{ key: 'ok', label: 'x', required: true, inputType: 'select' }],
    [{ key: 'ok', label: 'x', required: true, inputType: 'checkbox' }],
    [textField('name')],
    [textField('constructor')],
    [textField('toString')],
    [textField('k'.repeat(65))],
    [{ ...textField('ok'), label: 'x'.repeat(201) }],
    [{ ...textField('ok'), placeholder: 'x'.repeat(501) }],
    [{ ...textField('ok'), description: 'x'.repeat(2001) }],
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
    [[{ value: '', label: 'Empty' }]],
    [[{ value: 'v'.repeat(201), label: 'Long' }]],
    [
      Array.from({ length: 101 }, (_, i) => ({
        value: `v${i}`,
        label: `Option ${i}`,
      })),
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
