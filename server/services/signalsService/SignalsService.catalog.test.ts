import type {
  CatalogSignalEntry,
  CoopIntegrationPlugin,
  PluginSignalDescriptor,
} from '@roostorg/coop-types';
import { describe, expect, it } from 'vitest';

import type { PluginEntry } from '../integrationRegistry/loadPlugins.js';
import { PluginCatalogStore } from './helpers/pluginCatalogStore.js';
import PluginSignalAdapter from './signals/PluginSignalAdapter.js';

function signal(id: string, displayName = id): PluginSignalDescriptor {
  return {
    id: { type: id },
    displayName,
    description: 'catalog test signal',
    docsUrl: null,
    recommendedThresholds: null,
    supportedLanguages: 'ALL',
    pricingStructure: { type: 'FREE' },
    eligibleInputs: ['STRING'],
    outputType: { scalarType: 'NUMBER' },
    getCost: () => 1,
    run: async () => ({ outputType: 'NUMBER', score: 1 }),
    getDisabledInfo: async () => ({ disabled: false }),
    needsMatchingValues: false,
    eligibleSubcategories: [],
    needsActionPenalties: false,
    integration: 'TEST',
    allowedInAutomatedRules: true,
  };
}

function entry(
  refreshCatalog: NonNullable<CoopIntegrationPlugin['refreshCatalog']>,
): PluginEntry {
  return {
    packageSpec: 'test-plugin',
    integrationId: 'TEST',
    plugin: {
      manifest: {
        id: 'TEST',
        name: 'Test',
        version: '1',
        requiresConfig: false,
      },
      refreshCatalog,
      createCatalogSignal: (catalogEntry) => ({
        ...signal(catalogEntry.signalTypeId),
      }),
    },
  };
}

describe('org-scoped signal catalog resolution', () => {
  it('keeps refreshed signals scoped to the organization', async () => {
    const store = new PluginCatalogStore(
      [
        entry(async ({ orgId }) => ({
          version: orgId,
          signals: [catalogEntry('ORG_SIGNAL', { displayName: orgId })],
        })),
      ],
      new Set(),
      {},
      { getByIntegrationId: async () => ({}) } as never,
    );

    await store.ensureLoaded('org-a', 'TEST');
    expect(store.get('org-a', 'TEST')?.signals.ORG_SIGNAL.displayName).toBe(
      'org-a',
    );
    expect(store.get('org-b', 'TEST')).toBeUndefined();
  });

  it('resolves an org override over static signals while preserving the static baseline', async () => {
    const staticSignal = new PluginSignalAdapter({
      ...signal('STATIC_SIGNAL', 'static'),
      integration: 'TEST',
    });
    const store = new PluginCatalogStore(
      [
        entry(async () => ({
          version: '1',
          signals: [
            catalogEntry('STATIC_SIGNAL', { displayName: 'org override' }),
          ],
        })),
      ],
      new Set(),
      { STATIC_SIGNAL: staticSignal },
      { getByIntegrationId: async () => ({}) } as never,
    );

    await store.ensureLoaded('org-a', 'TEST');
    expect(store.get('org-a', 'TEST')?.signals.STATIC_SIGNAL.displayName).toBe(
      'org override',
    );
    expect(staticSignal.displayName).toBe('static');
  });
});

function catalogEntry(
  id: string,
  overrides: Partial<CatalogSignalEntry> = {},
): CatalogSignalEntry {
  const {
    id: _id,
    integration: _integration,
    getCost: _getCost,
    run: _run,
    getDisabledInfo: _getDisabledInfo,
    ...data
  } = signal(id);
  return { signalTypeId: id, ...data, ...overrides };
}
