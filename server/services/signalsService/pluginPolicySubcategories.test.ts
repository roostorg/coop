import type {
  CatalogSignalEntry,
  PluginSignalDescriptor,
  PluginSignalRunInput,
} from '@roostorg/coop-types';
import { describe, expect, it, vi } from 'vitest';

import type { PluginEntry } from '../integrationRegistry/loadPlugins.js';
import { PluginCatalogStore } from './helpers/pluginCatalogStore.js';
import PluginSignalAdapter from './signals/PluginSignalAdapter.js';

// One signal type whose remote "policies" (labels) differ per org. Each rule
// condition picks a policy via `subcategory` and sets its own threshold.
const remotePoliciesByApiKey: Record<string, { id: string; name: string }[]> = {
  'key-org-a': [
    { id: 'pol_harassment', name: 'Harassment' },
    { id: 'pol_toxicity', name: 'Toxicity' },
  ],
  'key-org-b': [{ id: 'pol_spam', name: 'Spam' }],
};

function pigeonSignal(
  eligibleSubcategories: PluginSignalDescriptor['eligibleSubcategories'],
  run: PluginSignalDescriptor['run'],
): PluginSignalDescriptor {
  return {
    id: { type: 'PIGEON' },
    displayName: 'Pigeon',
    description: 'Scores content against a policy configured in Pigeon.',
    docsUrl: null,
    recommendedThresholds: null,
    supportedLanguages: 'ALL',
    pricingStructure: { type: 'SUBSCRIPTION' },
    eligibleInputs: ['STRING'],
    outputType: { scalarType: 'NUMBER' },
    getCost: () => 10,
    run,
    getDisabledInfo: async () => ({ disabled: false }),
    needsMatchingValues: false,
    eligibleSubcategories,
    needsActionPenalties: false,
    integration: 'PIGEON',
    allowedInAutomatedRules: true,
  };
}

// The data-only form refreshCatalog() returns; Coop stores it.
function pigeonEntry(
  eligibleSubcategories: PluginSignalDescriptor['eligibleSubcategories'],
): CatalogSignalEntry {
  const {
    id: _id,
    integration: _integration,
    getCost: _getCost,
    run: _run,
    getDisabledInfo: _getDisabledInfo,
    ...data
  } = pigeonSignal(eligibleSubcategories, async () => ({}));
  return { signalTypeId: 'PIGEON', ...data };
}

function makeStore(run: PluginSignalDescriptor['run']) {
  const credentials: Record<string, { apiKey: string }> = {
    'org-a': { apiKey: 'key-org-a' },
    'org-b': { apiKey: 'key-org-b' },
  };
  const entry: PluginEntry = {
    packageSpec: 'pigeon-plugin',
    integrationId: 'PIGEON',
    plugin: {
      manifest: {
        id: 'PIGEON',
        name: 'Pigeon',
        version: '1',
        requiresConfig: true,
      },
      async refreshCatalog({ getCredential }) {
        const { apiKey } = await getCredential();
        const policies = remotePoliciesByApiKey[String(apiKey)] ?? [];
        return {
          version: policies.map((it) => it.id).join(','),
          signals: [
            pigeonEntry(
              policies.map((it) => ({
                id: it.id,
                label: it.name,
                childrenIds: [],
              })),
            ),
          ],
        };
      },
      createCatalogSignal: (entry) =>
        pigeonSignal(entry.eligibleSubcategories, run),
    },
  };
  const staticPigeon = new PluginSignalAdapter(pigeonSignal([], run));
  return new PluginCatalogStore([entry], new Set(), { PIGEON: staticPigeon }, {
    getByIntegrationId: async (_: string, orgId: string) => credentials[orgId],
  } as never);
}

describe('plugin signal with org-specific policies as subcategories', () => {
  it('lists each org’s remote policies, fetched with that org’s credentials', async () => {
    const store = makeStore(async () => ({
      outputType: { scalarType: 'NUMBER' },
      score: 0,
    }));
    await store.ensureLoaded('org-a', 'PIGEON');
    await store.ensureLoaded('org-b', 'PIGEON');

    const orgA = store.get('org-a', 'PIGEON')!.signals.PIGEON;
    const orgB = store.get('org-b', 'PIGEON')!.signals.PIGEON;

    expect(orgA.eligibleSubcategories).toEqual([
      { id: 'pol_harassment', label: 'Harassment', children: [] },
      { id: 'pol_toxicity', label: 'Toxicity', children: [] },
    ]);
    expect(orgB.eligibleSubcategories).toEqual([
      { id: 'pol_spam', label: 'Spam', children: [] },
    ]);
  });

  it('passes the condition’s policy to run() so each rule can use its own threshold', async () => {
    const run = vi.fn(async (input: PluginSignalRunInput) => ({
      outputType: { scalarType: 'NUMBER' },
      score: input.subcategory === 'pol_harassment' ? 0.9 : 0.4,
    }));
    const store = makeStore(run);
    await store.ensureLoaded('org-a', 'PIGEON');
    const pigeon = store.get('org-a', 'PIGEON')!.signals.PIGEON;

    const harassment = await pigeon.run({
      value: { type: 'STRING', value: 'hello' },
      orgId: 'org-a',
      subcategory: 'pol_harassment',
    } as never);
    const toxicity = await pigeon.run({
      value: { type: 'STRING', value: 'hello' },
      orgId: 'org-a',
      subcategory: 'pol_toxicity',
    } as never);

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ subcategory: 'pol_harassment' }),
    );
    expect(harassment).toMatchObject({ score: 0.9 });
    expect(toxicity).toMatchObject({ score: 0.4 });
  });

  it('converts nested plugin subcategories into a tree', () => {
    const adapter = new PluginSignalAdapter(
      pigeonSignal(
        [
          { id: 'abuse', label: 'Abuse', childrenIds: ['threats', 'slurs'] },
          { id: 'threats', label: 'Threats', childrenIds: [] },
          { id: 'slurs', label: 'Slurs', childrenIds: [] },
          { id: 'spam', label: 'Spam', childrenIds: [] },
        ],
        async () => ({ outputType: { scalarType: 'NUMBER' }, score: 0 }),
      ),
    );

    expect(adapter.eligibleSubcategories).toEqual([
      {
        id: 'abuse',
        label: 'Abuse',
        children: [
          { id: 'threats', label: 'Threats', children: [] },
          { id: 'slurs', label: 'Slurs', children: [] },
        ],
      },
      { id: 'spam', label: 'Spam', children: [] },
    ]);
  });

  it('rejects a refresh with malformed policy entries', async () => {
    const malformedPolicy: unknown = { id: 42, label: 'Bad' };
    const store = new PluginCatalogStore(
      [
        {
          packageSpec: 'pigeon-plugin',
          integrationId: 'PIGEON',
          plugin: {
            manifest: {
              id: 'PIGEON',
              name: 'Pigeon',
              version: '1',
              requiresConfig: true,
            },
            refreshCatalog: async () => ({
              version: '1',
              signals: [pigeonEntry([malformedPolicy as never])],
            }),
            createCatalogSignal: (entry) =>
              pigeonSignal(entry.eligibleSubcategories, async () => ({})),
          },
        },
      ],
      new Set(),
      {},
      { getByIntegrationId: async () => ({}) } as never,
    );

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'PIGEON' }),
    ).rejects.toMatchObject({
      name: 'IntegrationCatalogRefreshError',
      detail: 'INVALID_DESCRIPTOR: PIGEON has invalid eligibleSubcategories',
    });
  });
});
