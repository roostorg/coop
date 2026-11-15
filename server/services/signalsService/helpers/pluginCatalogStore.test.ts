import type {
  CatalogSignalEntry,
  CoopIntegrationPlugin,
  PluginSignalDescriptor,
} from '@roostorg/coop-types';
import { describe, expect, it, vi } from 'vitest';

import type { PluginEntry } from '../../integrationRegistry/loadPlugins.js';
import PluginSignalAdapter from '../signals/PluginSignalAdapter.js';
import { PluginCatalogStore } from './pluginCatalogStore.js';

const descriptor = (id: string): PluginSignalDescriptor => {
  const signal: PluginSignalDescriptor = {
    id: { type: id },
    displayName: id,
    description: 'test signal',
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
  return signal;
};

function makeEntry(
  refreshCatalog: NonNullable<CoopIntegrationPlugin['refreshCatalog']>,
  integrationId = 'TEST',
  createCatalogSignal: CoopIntegrationPlugin['createCatalogSignal'] = (
    entry,
  ) => ({
    ...descriptor(entry.signalTypeId),
  }),
): PluginEntry {
  return {
    packageSpec: 'test-plugin',
    integrationId,
    plugin: {
      manifest: {
        id: integrationId,
        name: integrationId,
        version: '1.0.0',
        requiresConfig: false,
      },
      refreshCatalog,
      createCatalogSignal,
    },
  };
}

function makeStore(
  refreshCatalog: NonNullable<CoopIntegrationPlugin['refreshCatalog']>,
  integrationId = 'TEST',
  options?: {
    timeoutMs?: number;
    ttlMs?: number;
    cacheTtlMs?: number;
    failureBackoffMs?: number;
    repository?: import('./pluginCatalogRepository.js').PluginCatalogRepository;
  },
  createCatalogSignal?: CoopIntegrationPlugin['createCatalogSignal'],
) {
  return new PluginCatalogStore(
    [makeEntry(refreshCatalog, integrationId, createCatalogSignal)],
    new Set(),
    {},
    { getByIntegrationId: async () => ({}) } as never,
    options,
  );
}

function makeStaticSignal(id: string, integration: string) {
  return new PluginSignalAdapter({
    ...descriptor(id),
    integration,
  });
}

function catalogSignal(
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
  } = descriptor(id);
  return { signalTypeId: id, ...data, ...overrides };
}

describe('PluginCatalogStore', () => {
  it('replaces a catalog and keeps it private to the organization', async () => {
    const store = makeStore(async ({ orgId }) => ({
      version: orgId,
      signals: [catalogSignal('DYNAMIC_SIGNAL')],
    }));

    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    expect(store.get('org-a', 'TEST')?.version).toBe('org-a');
    expect(store.get('org-b', 'TEST')).toBeUndefined();
  });

  it('notifies listeners after successful refresh and isolates listener errors', async () => {
    const store = makeStore(async () => ({ version: '1', signals: [] }));
    const listener = vi.fn(() => {
      throw new Error('listener failure');
    });
    store.onPluginCatalogRefreshed(listener);

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).resolves.toMatchObject({ version: '1' });
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-a', integrationId: 'TEST' }),
    );
  });

  it('deduplicates concurrent refreshes', async () => {
    let calls = 0;
    const store = makeStore(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { version: '1', signals: [] };
    });

    await Promise.all([
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ]);
    expect(calls).toBe(1);
  });

  it('times out plugins that ignore abortSignal', async () => {
    const store = makeStore(async () => new Promise(() => undefined), 'TEST', {
      timeoutMs: 1,
    });

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ name: 'IntegrationCatalogRefreshError' });
    expect(store.getStatus('org-a', 'TEST').status).toBe('ERROR');
  });

  it('rejects invalid descriptors without installing them', async () => {
    const store = makeStore(async () => ({
      version: '1',
      signals: [catalogSignal('bad-id')],
    }));

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ name: 'IntegrationCatalogRefreshError' });
    expect(store.get('org-a', 'TEST')?.signals).toEqual({});
    expect(store.getStatus('org-a', 'TEST').status).toBe('ERROR');
  });

  it('rejects a catalog whose policies list an unknown child', async () => {
    const store = makeStore(async () => ({
      version: '1',
      signals: [
        catalogSignal('POLICY_SIGNAL', {
          eligibleSubcategories: [
            { id: 'HARASSMENT', label: 'Harassment', childrenIds: ['GONE'] },
          ],
        }),
      ],
    }));

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({
      detail:
        'INVALID_DESCRIPTOR: POLICY_SIGNAL has invalid eligibleSubcategories',
    });
  });

  it('rejects built-in collisions and keeps the previous catalog', async () => {
    let ids = ['DYNAMIC_SIGNAL'];
    const store = new PluginCatalogStore(
      [
        makeEntry(async () => ({
          version: String(ids.length),
          signals: ids.map((id) => catalogSignal(id)),
        })),
      ],
      new Set(['BUILT_IN']),
      {},
      { getByIntegrationId: async () => ({}) } as never,
    );

    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    ids = ['BUILT_IN'];
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ detail: 'COLLISION:BUILT_IN' });
    expect(store.get('org-a', 'TEST')?.signals.DYNAMIC_SIGNAL).toBeDefined();
    expect(store.getStatus('org-a', 'TEST')).toMatchObject({
      status: 'ERROR',
      errorMessage: 'COLLISION:BUILT_IN',
    });
  });

  it('allows same-integration static overrides but rejects other integrations', async () => {
    const staticSignals = {
      SAME_STATIC: makeStaticSignal('SAME_STATIC', 'TEST'),
      OTHER_STATIC: makeStaticSignal('OTHER_STATIC', 'OTHER'),
    };
    const store = new PluginCatalogStore(
      [
        makeEntry(async () => ({
          version: '1',
          signals: [
            catalogSignal('SAME_STATIC'),
            catalogSignal('OTHER_STATIC'),
          ],
        })),
      ],
      new Set(),
      staticSignals,
      { getByIntegrationId: async () => ({}) } as never,
    );

    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ detail: 'COLLISION:OTHER_STATIC' });
    expect(store.get('org-a', 'TEST')?.signals).toEqual({});
    const sameOnly = new PluginCatalogStore(
      [
        makeEntry(async () => ({
          version: '1',
          signals: [catalogSignal('SAME_STATIC')],
        })),
      ],
      new Set(),
      staticSignals,
      { getByIntegrationId: async () => ({}) } as never,
    );
    await sameOnly.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    expect(sameOnly.get('org-a', 'TEST')?.signals.SAME_STATIC).toBeDefined();
  });

  it('rejects refreshed collisions only within the same organization', async () => {
    const store = new PluginCatalogStore(
      [
        makeEntry(async () => ({
          version: 'test',
          signals: [catalogSignal('SHARED')],
        })),
        makeEntry(
          async () => ({
            version: 'other',
            signals: [catalogSignal('SHARED')],
          }),
          'OTHER',
        ),
      ],
      new Set(),
      {},
      { getByIntegrationId: async () => ({}) } as never,
    );

    await store.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'OTHER',
    });
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({ detail: 'COLLISION:SHARED' });
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-b', integrationId: 'TEST' }),
    ).resolves.toMatchObject({ signalCount: 1 });
  });

  it('creates and clears tombstones and reports added and removed ids', async () => {
    let ids = ['FIRST', 'SECOND'];
    const store = makeStore(async () => ({
      version: String(ids.length),
      signals: ids.map((id) => catalogSignal(id)),
    }));
    const first = await store.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    expect(first.addedSignalTypeIds).toEqual(['FIRST', 'SECOND']);
    ids = ['FIRST'];
    const second = await store.refreshPluginCatalog({
      orgId: 'org-a',
      integrationId: 'TEST',
    });
    expect(second.removedSignalTypeIds).toEqual(['SECOND']);
    const tombstone = store.get('org-a', 'TEST')?.tombstones.SECOND;
    await expect(tombstone?.getDisabledInfo('org-a')).resolves.toEqual({
      disabled: true,
      disabledMessage: 'This signal was removed from the integration catalog.',
    });
    await expect(tombstone?.run({} as never)).rejects.toMatchObject({
      name: 'SignalPermanentError',
    });
    ids = ['FIRST', 'SECOND'];
    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    expect(store.get('org-a', 'TEST')?.tombstones.SECOND).toBeUndefined();
  });

  it('lazy-loads once, backs off failures, and retries after the backoff', async () => {
    let calls = 0;
    const store = makeStore(
      async () => {
        calls += 1;
        throw new Error('failure');
      },
      'TEST',
      { failureBackoffMs: 100 },
    );
    await expect(store.ensureLoaded('org-a', 'TEST')).rejects.toBeInstanceOf(
      Error,
    );
    await store.ensureLoaded('org-a', 'TEST');
    expect(calls).toBe(1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 101);
    await expect(store.ensureLoaded('org-a', 'TEST')).rejects.toBeInstanceOf(
      Error,
    );
    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it('serves stale catalogs while triggering a background refresh', async () => {
    let calls = 0;
    const store = makeStore(
      async () => ({
        version: String(++calls),
        signals: [catalogSignal('SIGNAL')],
      }),
      'TEST',
      { ttlMs: 1 },
    );
    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.ensureLoaded('org-a', 'TEST');
    expect(store.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
    await vi.waitFor(() => expect(calls).toBe(2));
  });

  it('keeps a good catalog after a failed refresh', async () => {
    let fail = false;
    const store = makeStore(async () => {
      if (fail) throw new Error('failure');
      return { version: '1', signals: [catalogSignal('SIGNAL')] };
    });
    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    fail = true;
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toBeInstanceOf(Error);
    expect(store.get('org-a', 'TEST')?.signals.SIGNAL).toBeDefined();
    expect(store.getStatus('org-a', 'TEST')).toMatchObject({ status: 'ERROR' });
  });

  it.each([
    ['run', { run: undefined }],
    ['getDisabledInfo', { getDisabledInfo: undefined }],
    ['getCost', { getCost: undefined }],
  ])('names invalid descriptor field: %s', async (field, override) => {
    const store = makeStore(
      async () => ({
        version: '1',
        signals: [catalogSignal('BAD_SIGNAL')],
      }),
      'TEST',
      undefined,
      (entry) => ({
        ...descriptor(entry.signalTypeId),
        [field]: override[field as keyof typeof override],
      }),
    );
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({
      detail: `INVALID_DESCRIPTOR: BAD_SIGNAL has invalid ${field}`,
    });
  });

  it('names catalogs exceeding the signal limit', async () => {
    const store = makeStore(async () => ({
      version: '1',
      signals: Array.from({ length: 501 }, (_, index) =>
        catalogSignal(`SIGNAL_${index}`),
      ),
    }));
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({
      detail: 'INVALID_CATALOG: more than 500 signals',
    });
  });

  it('binds credential lookup to the refreshing organization', async () => {
    let calls: string[] = [];
    const store = new PluginCatalogStore(
      [
        makeEntry(async ({ getCredential }) => {
          await getCredential();
          return { version: '1', signals: [] };
        }),
      ],
      new Set(),
      {},
      {
        getByIntegrationId: async (_integrationId: string, orgId: string) => {
          calls = [...calls, orgId];
          return { key: 'fake' };
        },
      } as never,
    );
    await store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' });
    expect(calls).toEqual(['org-a']);
  });

  it('rejects integrations without refreshCatalog', async () => {
    const entry = makeEntry(async () => ({ version: '1', signals: [] }));
    const store = new PluginCatalogStore(
      [{ ...entry, plugin: { manifest: entry.plugin.manifest } }],
      new Set(),
      {},
      { getByIntegrationId: async () => ({}) } as never,
    );
    expect(store.supportsCatalogRefresh('TEST')).toBe(false);
    await expect(
      store.refreshPluginCatalog({ orgId: 'org-a', integrationId: 'TEST' }),
    ).rejects.toMatchObject({
      name: 'IntegrationConfigUnsupportedIntegrationError',
    });
  });
});
