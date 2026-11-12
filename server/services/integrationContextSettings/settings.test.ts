import {
  buildStoredPluginConfig,
  CONTEXT_SETTINGS_KEY,
  describeContextOptions,
  readOrgContextSettings,
  resolveContextNeeds,
  sanitizeContextSettings,
  validateContextOptions,
  withoutContextSettings,
} from './settings.js';

describe('validateContextOptions', () => {
  it('returns undefined when the manifest declares none', () => {
    expect(validateContextOptions('TEST', undefined)).toBeUndefined();
    expect(validateContextOptions('TEST', {})).toBeUndefined();
  });

  it("fills the platform default count and keeps the plugin's limit", () => {
    expect(
      validateContextOptions('TEST', {
        thread: { default: 'include', maxMessagesLimit: 500 },
        parent: { default: 'off' },
      }),
    ).toEqual({
      thread: { default: 'include', defaultMaxCount: 20, maxCountLimit: 500 },
      parent: { default: 'off' },
    });
  });

  it('leaves the count unlimited when the plugin sets no limit', () => {
    const options = validateContextOptions('TEST', {
      thread: { default: 'include' },
    })!;

    expect(options).toEqual({
      thread: { default: 'include', defaultMaxCount: 20 },
    });
    expect(
      sanitizeContextSettings(options, [
        { kind: 'thread', mode: 'include', maxCount: 300 },
      ]),
    ).toEqual({ thread: { mode: 'include', maxCount: 300 } });
  });

  it('ignores kinds Coop does not support', () => {
    expect(
      validateContextOptions('TEST', {
        relatedItems: { default: 'include', maxItemsLimit: 5 },
      }),
    ).toBeUndefined();
  });

  it('keeps the default count within the plugin limit', () => {
    expect(
      validateContextOptions('TEST', {
        thread: {
          default: 'include',
          defaultMaxMessages: 30,
          maxMessagesLimit: 10,
        },
      }),
    ).toEqual({
      thread: { default: 'include', defaultMaxCount: 10, maxCountLimit: 10 },
    });
  });

  it.each([
    [[]],
    [{ thread: { default: 'maybe' } }],
    [{ thread: { default: 'include', maxMessagesLimit: 0 } }],
    [{ thread: { default: 'off', defaultMaxMessages: 2.5 } }],
    [{ parent: 'include' }],
  ])('rejects malformed options %#', (value) => {
    expect(() => validateContextOptions('TEST', value)).toThrow(
      'Integration "TEST"',
    );
  });
});

const options = validateContextOptions('TEST', {
  thread: { default: 'include', defaultMaxMessages: 10, maxMessagesLimit: 50 },
  parent: { default: 'off' },
})!;

describe('org context settings', () => {
  it('clamps counts and ignores counts for kinds without one on save', () => {
    expect(
      sanitizeContextSettings(options, [
        { kind: 'thread', mode: 'include', maxCount: 500 },
        { kind: 'parent', mode: 'include', maxCount: 3 },
      ]),
    ).toEqual({
      thread: { mode: 'include', maxCount: 50 },
      parent: { mode: 'include' },
    });
  });

  it('drops kinds the plugin did not declare on save', () => {
    const threadOnly = validateContextOptions('TEST', {
      thread: { default: 'off' },
    })!;
    expect(
      sanitizeContextSettings(threadOnly, [
        { kind: 'parent', mode: 'include' },
      ]),
    ).toEqual({});
  });

  it('reads saved settings defensively', () => {
    expect(
      readOrgContextSettings({
        apiKey: 'test-api-key',
        [CONTEXT_SETTINGS_KEY]: {
          thread: { mode: 'off', maxCount: 5 },
          parent: { mode: 'sometimes' },
          relatedItems: 'include',
        },
      }),
    ).toEqual({ thread: { mode: 'off', maxCount: 5 } });
    expect(readOrgContextSettings(undefined)).toEqual({});
  });

  it('keeps context settings out of the config plugins see', () => {
    expect(
      withoutContextSettings({
        apiKey: 'test-api-key',
        [CONTEXT_SETTINGS_KEY]: { thread: { mode: 'off' } },
      }),
    ).toEqual({ apiKey: 'test-api-key' });
  });

  it('describes defaults and org choices for the UI', () => {
    expect(
      describeContextOptions(options, { parent: { mode: 'include' } }),
    ).toEqual([
      {
        kind: 'thread',
        defaultMode: 'include',
        mode: 'default',
        included: true,
        defaultMaxCount: 10,
        maxCountLimit: 50,
      },
      { kind: 'parent', defaultMode: 'off', mode: 'include', included: true },
    ]);
  });
});

describe('buildStoredPluginConfig', () => {
  const existingConfig = {
    apiKey: 'old-key',
    [CONTEXT_SETTINGS_KEY]: { thread: { mode: 'off' } },
  };

  it('stores validated settings when the save includes them', () => {
    expect(
      buildStoredPluginConfig({
        credential: { apiKey: 'test-api-key' },
        contextOptions: options,
        contextSettings: [{ kind: 'thread', mode: 'include', maxCount: 99 }],
        existingConfig,
      }),
    ).toEqual({
      apiKey: 'test-api-key',
      [CONTEXT_SETTINGS_KEY]: { thread: { mode: 'include', maxCount: 50 } },
    });
  });

  it('keeps the stored settings when the save omits them', () => {
    expect(
      buildStoredPluginConfig({
        credential: { apiKey: 'test-api-key' },
        contextOptions: options,
        contextSettings: undefined,
        existingConfig,
      }),
    ).toEqual({
      apiKey: 'test-api-key',
      [CONTEXT_SETTINGS_KEY]: { thread: { mode: 'off' } },
    });
  });

  it('ignores the reserved key when a client sends it in the credential', () => {
    expect(
      buildStoredPluginConfig({
        credential: {
          apiKey: 'test-api-key',
          [CONTEXT_SETTINGS_KEY]: { relatedItems: { mode: 'include' } },
        },
        contextOptions: undefined,
        contextSettings: undefined,
        existingConfig: undefined,
      }),
    ).toEqual({ apiKey: 'test-api-key' });
  });
});

describe('resolveContextNeeds', () => {
  it('uses plugin defaults when the org has not chosen', () => {
    expect(resolveContextNeeds(undefined, options, {})).toEqual({
      includeThread: true,
      maxThreadMessages: 10,
    });
  });

  it('applies the org choice and count', () => {
    expect(
      resolveContextNeeds(undefined, options, {
        thread: { mode: 'include', maxCount: 25 },
        parent: { mode: 'include' },
      }),
    ).toEqual({
      includeThread: true,
      includeParent: true,
      maxThreadMessages: 25,
    });
  });

  it('returns undefined when everything is off and the signal needs nothing', () => {
    expect(
      resolveContextNeeds(undefined, options, { thread: { mode: 'off' } }),
    ).toBeUndefined();
  });

  it('never removes context the signal itself requires', () => {
    expect(
      resolveContextNeeds(
        { includeThread: true, maxThreadMessages: 5 },
        options,
        { thread: { mode: 'off' } },
      ),
    ).toEqual({ includeThread: true, maxThreadMessages: 5 });
  });

  it('keeps the larger count when both the signal and the org ask for a thread', () => {
    expect(
      resolveContextNeeds(
        { includeThread: true, maxThreadMessages: 30 },
        options,
        {
          thread: { mode: 'include', maxCount: 12 },
        },
      ),
    ).toEqual({ includeThread: true, maxThreadMessages: 30 });
  });

  it('gives a signal that needs a thread at least the platform default count', () => {
    // The plugin default is 10; including the thread must not lower the 20
    // messages the signal would get on its own.
    expect(
      resolveContextNeeds({ includeThread: true }, options, {
        thread: { mode: 'include' },
      }),
    ).toEqual({ includeThread: true, maxThreadMessages: 20 });
  });

  it('caps a saved count at the plugin limit, even if the limit was lowered later', () => {
    expect(
      resolveContextNeeds(undefined, options, {
        thread: { mode: 'include', maxCount: 80 },
      }),
    ).toEqual({ includeThread: true, maxThreadMessages: 50 });
  });

  it('passes signal needs through for integrations without options', () => {
    expect(resolveContextNeeds({ includeParent: true }, undefined, {})).toEqual(
      { includeParent: true },
    );
  });
});
