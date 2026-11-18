import { vi } from 'vitest';

import { type RuleInput } from '../../rule_engine/RuleEvaluator.js';

const PLUGIN_SIGNAL = 'ACME_THREAD_SIGNAL';
const getManifest =
  vi.fn<(id: string) => { requiresConfig: boolean } | undefined>();

// The server suite shares modules across files (isolate: false), so mocks are
// registered for a fresh module graph here and removed afterwards.
const mockedModules = {
  '../integrationRegistry/index.js': () => ({
    getIntegrationRegistry: () => ({
      getPluginEntries: () => [],
      getManifest,
    }),
  }),
  './helpers/instantiateBuiltInSignals.js': () => ({
    instantiateBuiltInSignals: () => ({}),
  }),
  './helpers/makeCachedCredentialsGetters.js': () => ({
    makeCachedCredentialGetters: () => ({ close: async () => undefined }),
  }),
  './helpers/makeCachedFetchers.js': () => ({
    makeCachedFetchers: () => ({}),
  }),
  './helpers/loadPluginSignals.js': async () => {
    const { default: PluginSignalAdapter } =
      await import('./signals/PluginSignalAdapter.js');
    return {
      loadPluginSignals: () => ({
        [PLUGIN_SIGNAL]: new PluginSignalAdapter({
          id: { type: PLUGIN_SIGNAL },
          displayName: 'Acme thread signal',
          description: 'Scores a message with its thread.',
          docsUrl: null,
          recommendedThresholds: null,
          supportedLanguages: 'ALL',
          pricingStructure: { type: 'FREE' },
          eligibleInputs: ['STRING'],
          outputType: { scalarType: 'NUMBER' },
          getCost: () => 1,
          run: async () => ({ score: 0, outputType: { scalarType: 'NUMBER' } }),
          getDisabledInfo: async () => ({ disabled: false }),
          needsMatchingValues: false,
          eligibleSubcategories: [],
          needsActionPenalties: false,
          integration: 'ACME',
          allowedInAutomatedRules: true,
          contextNeeds: { includeThread: true, maxThreadMessages: 5 },
        }),
      }),
    };
  },
};

beforeAll(() => {
  vi.resetModules();
  for (const [path, factory] of Object.entries(mockedModules)) {
    vi.doMock(path, factory);
  }
});

afterAll(() => {
  for (const path of Object.keys(mockedModules)) vi.doUnmock(path);
  vi.resetModules();
});

async function makeContext(
  storedConfig: Record<string, unknown> | null = { apiKey: 'test-key' },
) {
  const { default: SignalsService } = await import('./SignalsService.js');
  const { default: RuleEvaluator } =
    await import('../../rule_engine/RuleEvaluator.js');
  const { makeIntegrationContextSettingsService } =
    await import('../integrationContextSettings/index.js');
  const signalsService = new SignalsService(
    ...(Array.from({ length: 9 }, () => ({})) as ConstructorParameters<
      typeof SignalsService
    >),
  );
  const load = vi.fn(async () => ({}));
  const evaluator = new RuleEvaluator(
    () => vi.fn() as never,
    signalsService,
    () => ({ load }),
    new makeIntegrationContextSettingsService({
      getByIntegrationId: vi.fn(async () => storedConfig ?? undefined),
    } as never),
    {} as never,
  );
  const input = {
    itemId: 'item-1',
    itemType: { id: 'type-1', kind: 'CONTENT', name: 'Message' },
  } as unknown as RuleInput;
  return {
    context: evaluator.makeRuleExecutionContext({ orgId: 'org-1', input }),
    load,
  };
}

describe('signal contextNeeds in rule evaluation', () => {
  beforeEach(() => {
    getManifest.mockReset();
  });

  it('loads the context a plugin signal declares', async () => {
    const { context, load } = await makeContext();

    await context.getSignalContext({ type: PLUGIN_SIGNAL });

    expect(load).toHaveBeenCalledWith({
      includeThread: true,
      maxThreadMessages: 5,
    });
  });

  it('loads nothing for an integration the org has not configured', async () => {
    getManifest.mockReturnValue({ requiresConfig: true });
    const { context, load } = await makeContext(null);

    await expect(
      context.getSignalContext({ type: PLUGIN_SIGNAL }),
    ).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('still loads context for plugins that need no config', async () => {
    getManifest.mockReturnValue({ requiresConfig: false });
    const { context, load } = await makeContext(null);

    await context.getSignalContext({ type: PLUGIN_SIGNAL });

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('skips custom signals without erroring', async () => {
    const { context, load } = await makeContext();

    await expect(
      context.getSignalContext({ type: 'CUSTOM', id: 'custom-1' } as never),
    ).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
