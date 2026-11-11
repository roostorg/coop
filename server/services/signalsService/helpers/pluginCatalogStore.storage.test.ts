import type {
  CatalogSignalEntry,
  CoopIntegrationPlugin,
  PluginSignalDescriptor,
} from '@roostorg/coop-types';
import { describe, expect, it, vi } from 'vitest';

import type { PluginEntry } from '../../integrationRegistry/loadPlugins.js';
import {
  makeInMemoryPluginCatalogRepository,
  type PluginCatalogRepository,
} from './pluginCatalogRepository.js';
import { PluginCatalogStore } from './pluginCatalogStore.js';
import { validateCatalog } from './validatePluginCatalog.js';

function entry(
  id: string,
  overrides: Partial<CatalogSignalEntry> = {},
): CatalogSignalEntry {
  return {
    signalTypeId: id,
    displayName: id,
    description: 'test signal',
    docsUrl: null,
    recommendedThresholds: null,
    supportedLanguages: 'ALL',
    pricingStructure: { type: 'FREE' },
    eligibleInputs: ['STRING'],
    outputType: { scalarType: 'NUMBER' },
    eligibleSubcategories: [],
    needsMatchingValues: false,
    needsActionPenalties: false,
    allowedInAutomatedRules: true,
    ...overrides,
  };
}

function runtime(
  catalogEntry: CatalogSignalEntry,
  overrides: Partial<PluginSignalDescriptor> = {},
): PluginSignalDescriptor {
  return {
    ...catalogEntry,
    id: { type: catalogEntry.signalTypeId },
    integration: 'TEST',
    getCost: () => 1,
    run: async () => ({ outputType: { scalarType: 'NUMBER' }, score: 1 }),
    getDisabledInfo: async () => ({ disabled: false }),
    ...overrides,
  };
}

function plugin(
  refreshCatalog: NonNullable<CoopIntegrationPlugin['refreshCatalog']>,
  integrationId = 'TEST',
  createCatalogSignal: NonNullable<
    CoopIntegrationPlugin['createCatalogSignal']
  > = (catalogEntry) => runtime(catalogEntry),
): PluginEntry {
  return {
    packageSpec: 'test-plugin',
    integrationId,
    plugin: {
      manifest: {
        id: integrationId,
        name: integrationId,
        version: '1',
        requiresConfig: false,
      },
      refreshCatalog,
      createCatalogSignal,
    },
  };
}

function store(
  entries: PluginEntry[],
  repository: PluginCatalogRepository,
  options: { cacheTtlMs?: number; ttlMs?: number } = {},
) {
  return new PluginCatalogStore(
    entries,
    new Set(),
    {},
    { getByIntegrationId: async () => ({}) } as never,
    { repository, cacheTtlMs: 0, ...options },
  );
}

describe('PluginCatalogStore storage', () => {
  it('serves a catalog refreshed on another instance without calling the plugin', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    const refreshA = vi.fn(async () => ({
      version: '1',
      signals: [entry('SIGNAL')],
    }));
    const refreshB = vi.fn(async () => ({ version: 'unused', signals: [] }));
    await store([plugin(refreshA)], repository).refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });

    const instanceB = store([plugin(refreshB)], repository);
    await instanceB.ensureLoaded('org-a', 'TEST');

    expect(instanceB.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
    expect(refreshB).not.toHaveBeenCalled();
  });

  it('serves stored signals and removed-signal tombstones after a restart', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    let ids = ['KEPT', 'REMOVED'];
    const first = store(
      [
        plugin(async () => ({
          version: ids.join(','),
          signals: ids.map((id) => entry(id)),
        })),
      ],
      repository,
    );
    await first.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    ids = ['KEPT'];
    await first.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });

    const refresh = vi.fn();
    const restarted = store([plugin(refresh)], repository);
    await restarted.ensureLoaded('org-a', 'TEST');
    const catalog = restarted.get('org-a', 'TEST');

    expect(refresh).not.toHaveBeenCalled();
    expect(catalog?.signals.KEPT).toBeDefined();
    await expect(
      catalog?.tombstones.REMOVED.getDisabledInfo('org-a'),
    ).resolves.toMatchObject({ disabled: true });
  });

  it('refreshes in the background when the stored catalog is too old', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    let calls = 0;
    const instance = store(
      [
        plugin(async () => ({
          version: String(++calls),
          signals: [entry('SIGNAL')],
        })),
      ],
      repository,
      { ttlMs: 1 },
    );
    await instance.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));

    await instance.ensureLoaded('org-a', 'TEST');
    expect(instance.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
    await vi.waitFor(async () =>
      expect((await repository.get('org-a', 'TEST'))?.version).toBe('2'),
    );
  });

  it('keeps the last good catalog and shares the failure with other instances', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    let fail = false;
    const refresh = async () => {
      if (fail) throw new Error('provider down');
      return { version: '1', signals: [entry('SIGNAL')] };
    };
    const instanceA = store([plugin(refresh)], repository);
    await instanceA.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    fail = true;
    await expect(
      instanceA.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ detail: 'PLUGIN_ERROR' });

    const instanceB = store([plugin(refresh)], repository);
    await instanceB.ensureLoaded('org-a', 'TEST');
    expect(instanceB.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
    expect(instanceB.getStatus('org-a', 'TEST')).toMatchObject({
      status: 'ERROR',
      errorMessage: 'PLUGIN_ERROR',
    });
  });

  it('skips stored entries the plugin can no longer build', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    await store(
      [
        plugin(async () => ({
          version: '1',
          signals: [entry('GOOD'), entry('LEGACY')],
        })),
      ],
      repository,
    ).refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });

    const upgraded = store(
      [
        plugin(
          async () => ({ version: 'unused', signals: [] }),
          'TEST',
          (catalogEntry) => {
            if (catalogEntry.signalTypeId === 'LEGACY') {
              throw new Error('no longer supported');
            }
            return runtime(catalogEntry);
          },
        ),
      ],
      repository,
    );
    await upgraded.ensureLoaded('org-a', 'TEST');

    expect(upgraded.get('org-a', 'TEST')?.signals.GOOD).toBeDefined();
    expect(upgraded.get('org-a', 'TEST')?.signals.LEGACY).toBeUndefined();
  });

  it('rejects a refresh with an entry the plugin cannot build, saving nothing new', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    const instance = store(
      [
        plugin(
          async () => ({ version: '1', signals: [entry('BROKEN')] }),
          'TEST',
          () => {
            throw new Error('cannot build');
          },
        ),
      ],
      repository,
    );

    await expect(
      instance.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ name: 'IntegrationCatalogRefreshError' });
    expect((await repository.get('org-a', 'TEST'))?.entries).toEqual([]);
  });

  it('uses stored entry data over what createCatalogSignal returns', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    const instance = store(
      [
        plugin(
          async () => ({
            version: '1',
            signals: [entry('SIGNAL', { displayName: 'Stored name' })],
          }),
          'TEST',
          (catalogEntry) =>
            runtime(catalogEntry, { displayName: 'Plugin name' }),
        ),
      ],
      repository,
    );
    await instance.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });

    expect(instance.get('org-a', 'TEST')?.signals.SIGNAL.displayName).toBe(
      'Stored name',
    );
  });

  it("rejects ids already used by another integration's stored catalog in the same org", async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    const entries = [
      plugin(async () => ({ version: '1', signals: [entry('SHARED')] })),
      plugin(
        async () => ({ version: '1', signals: [entry('SHARED')] }),
        'OTHER',
      ),
    ];
    await store(entries, repository).refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'OTHER',
    });

    await expect(
      store(entries, repository).refreshPluginCatalog({
        orgId: 'org-a',
        integrationId: 'TEST',
      }),
    ).rejects.toMatchObject({ detail: 'COLLISION:SHARED' });
  });

  it('keeps serving the cached catalog when the repository is unreachable', async () => {
    const repository = makeInMemoryPluginCatalogRepository();
    const instance = store(
      [plugin(async () => ({ version: '1', signals: [entry('SIGNAL')] }))],
      repository,
    );
    await instance.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    vi.spyOn(repository, 'get').mockRejectedValue(new Error('db down'));

    await instance.ensureLoaded('org-a', 'TEST');
    expect(instance.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
  });
});

describe('validateCatalog', () => {
  it('keeps only known fields so stored entries match what was validated', () => {
    const catalog = validateCatalog({
      version: '1',
      signals: [
        { ...entry('SIGNAL'), extra: 'dropped', metadata: { model: 'm1' } },
      ],
    });

    expect(catalog.signals[0]).not.toHaveProperty('extra');
    expect(catalog.signals[0]?.metadata).toEqual({ model: 'm1' });
  });

  it.each([
    ['non-object metadata', { metadata: 'model-1' }],
    ['oversized metadata', { metadata: { blob: 'x'.repeat(20_000) } }],
  ])('rejects %s', (_name, overrides) => {
    expect(() =>
      validateCatalog({
        version: '1',
        signals: [{ ...entry('SIGNAL'), ...overrides }],
      }),
    ).toThrow('INVALID_DESCRIPTOR: SIGNAL has invalid metadata');
  });

  it('stores no functions even if a plugin includes them', () => {
    const catalog = validateCatalog({
      version: '1',
      signals: [{ ...entry('SIGNAL'), run: async () => ({}) }],
    });

    expect(catalog.signals[0]).not.toHaveProperty('run');
  });
});
