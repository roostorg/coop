import type { PluginSignalDescriptor } from '@roostorg/coop-types';
import { vi } from 'vitest';

const PLUGIN_SIGNAL = 'ACME_POLICY_SIGNAL';
const run = vi.fn(async () => ({
  score: 0.9,
  outputType: { scalarType: 'NUMBER' },
}));

const descriptor: PluginSignalDescriptor = {
  id: { type: PLUGIN_SIGNAL },
  displayName: 'Acme policies',
  description: 'Scores text against an org policy.',
  docsUrl: null,
  recommendedThresholds: null,
  supportedLanguages: 'ALL',
  pricingStructure: { type: 'FREE' },
  eligibleInputs: ['STRING'],
  outputType: { scalarType: 'NUMBER' },
  getCost: () => 1,
  run,
  getDisabledInfo: async () => ({ disabled: false }),
  needsMatchingValues: false,
  // Flat, as plugins declare them: HARASSMENT has one child policy.
  eligibleSubcategories: [
    { id: 'HARASSMENT', label: 'Harassment', childrenIds: ['THREATS'] },
    { id: 'THREATS', label: 'Threats', childrenIds: [] },
    { id: 'SPAM', label: 'Spam', childrenIds: [] },
  ],
  needsActionPenalties: false,
  integration: 'ACME',
  allowedInAutomatedRules: true,
};

// The server suite shares modules across files (isolate: false), so mocks are
// registered for a fresh module graph here and removed afterwards.
const mockedModules = {
  '../integrationRegistry/index.js': () => ({
    getIntegrationRegistry: () => ({
      getPluginEntries: () => [],
      getManifest: () => undefined,
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
        [PLUGIN_SIGNAL]: new PluginSignalAdapter(descriptor),
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

beforeEach(() => {
  run.mockClear();
});

async function makeSignalsService() {
  const { default: SignalsService } = await import('./SignalsService.js');
  return new SignalsService(
    ...(Array.from({ length: 9 }, () => ({})) as ConstructorParameters<
      typeof SignalsService
    >),
  );
}

async function runWithPolicy(subcategory: string) {
  const service = await makeSignalsService();
  return service.runSignal({
    signal: { orgId: 'org-1', signalId: { type: PLUGIN_SIGNAL } },
    input: {
      value: { type: 'STRING', value: 'some text' },
      subcategory,
      orgId: 'org-1',
    },
  } as never);
}

describe('plugin signal policies', () => {
  it('exposes flat plugin policies as a tree', async () => {
    const service = await makeSignalsService();
    const signal = await service.getSignal({
      orgId: 'org-1',
      signalId: { type: PLUGIN_SIGNAL },
    });

    expect(signal?.eligibleSubcategories).toEqual([
      {
        id: 'HARASSMENT',
        label: 'Harassment',
        children: [{ id: 'THREATS', label: 'Threats', children: [] }],
      },
      { id: 'SPAM', label: 'Spam', children: [] },
    ]);
  });

  it('runs the plugin for a policy it offers, including child policies', async () => {
    await runWithPolicy('THREATS');

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ subcategory: 'THREATS' }),
    );
  });

  it("returns a permanent error without calling the plugin when the policy isn't offered", async () => {
    const result = await runWithPolicy('REMOVED_POLICY');

    expect(result).toMatchObject({ type: 'ERROR' });
    expect(run).not.toHaveBeenCalled();
  });
});
