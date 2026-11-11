import type { CatalogSignalEntry } from '@roostorg/coop-types';

import { CoopError, ErrorType } from '../../../utils/errors.js';
import { withoutContextSettings } from '../../integrationContextSettings/settings.js';
import type { PluginEntry } from '../../integrationRegistry/loadPlugins.js';
import type { SignalAuthService } from '../../signalAuthService/index.js';
import type PluginSignalAdapter from '../signals/PluginSignalAdapter.js';
import type { SignalBase, SignalInputType } from '../signals/SignalBase.js';
import type { SignalOutputType } from '../types/SignalOutputType.js';
import {
  buildCatalogSignal,
  hydratePluginCatalog,
} from './hydratePluginCatalog.js';
import {
  makeInMemoryPluginCatalogRepository,
  type PluginCatalogRepository,
  type StoredPluginCatalog,
} from './pluginCatalogRepository.js';
import { validateCatalog } from './validatePluginCatalog.js';

type Adapter = SignalBase<SignalInputType, SignalOutputType, unknown, string>;

export type PluginCatalogStatus = 'OK' | 'ERROR';
export type PluginCatalog = {
  version: string;
  signals: Record<string, PluginSignalAdapter>;
  tombstones: Record<string, PluginSignalAdapter>;
  fetchedAt: Date;
  status: PluginCatalogStatus;
  errorMessage?: string;
};

export type PluginCatalogRefreshResult = {
  version: string;
  signalCount: number;
  fetchedAt: Date;
  addedSignalTypeIds: string[];
  removedSignalTypeIds: string[];
};
export type PluginCatalogRefreshListener = (event: {
  orgId: string;
  integrationId: string;
  result: PluginCatalogRefreshResult;
}) => void;

type StoreOptions = {
  timeoutMs?: number;
  /** Age after which a stored catalog is refreshed in the background. */
  ttlMs?: number;
  /** How long a pod reuses what it read from the repository. */
  cacheTtlMs?: number;
  failureBackoffMs?: number;
  repository?: PluginCatalogRepository;
};

type CacheEntry = {
  stored: StoredPluginCatalog | undefined;
  catalog: PluginCatalog | undefined;
  loadedAt: number;
};

/**
 * Org-specific plugin catalogs. The repository (Postgres in production) is
 * the source of truth shared by all API instances; each instance keeps a
 * short read-through cache and rebuilds runnable signals from stored entries
 * with the plugin's createCatalogSignal(). The provider is only called to
 * refresh: on demand, when nothing is stored yet, or in the background once
 * the stored catalog is older than ttlMs.
 */
export class PluginCatalogStore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, number>();
  private readonly inFlight = new Map<
    string,
    Promise<PluginCatalogRefreshResult>
  >();
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly cacheTtlMs: number;
  private readonly failureBackoffMs: number;
  private readonly repository: PluginCatalogRepository;
  private readonly refreshListeners = new Set<PluginCatalogRefreshListener>();

  constructor(
    private readonly pluginEntries: readonly PluginEntry[],
    private readonly builtInIds: ReadonlySet<string>,
    private readonly staticSignals: Readonly<Record<string, Adapter>>,
    private readonly signalAuthService: SignalAuthService,
    options: StoreOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000;
    this.cacheTtlMs = options.cacheTtlMs ?? 30 * 1000;
    this.failureBackoffMs = options.failureBackoffMs ?? 60 * 1000;
    this.repository =
      options.repository ?? makeInMemoryPluginCatalogRepository();
  }

  get refreshableIntegrationIds(): readonly string[] {
    return this.pluginEntries
      .filter((entry) => typeof entry.plugin.refreshCatalog === 'function')
      .map((entry) => entry.integrationId);
  }

  supportsCatalogRefresh(integrationId: string): boolean {
    return this.refreshableIntegrationIds.includes(integrationId);
  }

  async ensureLoaded(orgId: string, integrationId: string): Promise<void> {
    if (!this.supportsCatalogRefresh(integrationId)) return;
    const key = this.key(orgId, integrationId);
    const cached = this.cache.get(key);
    if (!cached || Date.now() - cached.loadedAt > this.cacheTtlMs) {
      await this.loadFromRepository(orgId, integrationId);
    }
    const stored = this.cache.get(key)?.stored;
    // A stored failure from a catalog that never loaded doesn't count as a
    // catalog: retry it, but only after the backoff (on any instance).
    const neverLoaded =
      stored == null ||
      (stored.status === 'ERROR' && stored.entries.length === 0);
    if (neverLoaded) {
      // Lazy loads run on signal lookups during rule execution, so a failing
      // plugin must not make every lookup wait for another timeout.
      const failedAt = this.failures.get(key) ?? stored?.fetchedAt.getTime();
      if (failedAt != null && Date.now() - failedAt < this.failureBackoffMs) {
        return;
      }
      await this.refreshPluginCatalog({ orgId, integrationId }).then(
        () => undefined,
      );
    } else if (
      Date.now() - stored.fetchedAt.getTime() > this.ttlMs &&
      !this.inFlight.has(key)
    ) {
      this.refreshPluginCatalog({ orgId, integrationId }).catch(
        () => undefined,
      );
    }
  }

  get(orgId: string, integrationId: string): PluginCatalog | undefined {
    return this.cache.get(this.key(orgId, integrationId))?.catalog;
  }

  onPluginCatalogRefreshed(listener: PluginCatalogRefreshListener): () => void {
    this.refreshListeners.add(listener);
    return () => this.refreshListeners.delete(listener);
  }

  async refreshPluginCatalog({
    orgId,
    integrationId,
  }: {
    orgId: string;
    integrationId: string;
  }): Promise<PluginCatalogRefreshResult> {
    const key = this.key(orgId, integrationId);
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.refresh(orgId, integrationId);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Status after a first load, so it matches what signal lookups see. */
  async loadStatus(orgId: string, integrationId: string) {
    await this.ensureLoaded(orgId, integrationId).catch(() => undefined);
    return this.getStatus(orgId, integrationId);
  }

  getStatus(orgId: string, integrationId: string) {
    const cached = this.cache.get(this.key(orgId, integrationId));
    const catalog = cached?.catalog;
    const stored = cached?.stored;
    return {
      supportsRefresh: this.supportsCatalogRefresh(integrationId),
      version: stored && stored.version !== '' ? stored.version : undefined,
      signalCount: catalog ? Object.keys(catalog.signals).length : undefined,
      fetchedAt: stored?.fetchedAt,
      status: stored?.status,
      errorMessage: stored?.errorMessage ?? undefined,
      signals: Object.entries(catalog?.signals ?? {}).map(
        ([signalTypeId, signal]) => ({
          signalTypeId,
          displayName: signal.displayName,
          subcategories: signal.eligibleSubcategories.flatMap((it) => [
            { id: it.id, label: it.label },
            ...it.children.map((child) => ({
              id: child.id,
              label: child.label,
            })),
          ]),
        }),
      ),
    };
  }

  private async loadFromRepository(orgId: string, integrationId: string) {
    const key = this.key(orgId, integrationId);
    const pending = this.loading.get(key);
    if (pending) return pending;
    const load = (async () => {
      try {
        const stored = await this.repository.get(orgId, integrationId);
        this.setCache(key, stored);
      } catch {
        // Keep serving what this instance already has if the store is down.
        const cached = this.cache.get(key);
        if (cached) cached.loadedAt = Date.now();
      }
    })();
    this.loading.set(key, load);
    try {
      await load;
    } finally {
      this.loading.delete(key);
    }
  }

  private setCache(key: string, stored: StoredPluginCatalog | undefined) {
    this.cache.set(key, {
      stored,
      catalog: stored ? this.hydrate(stored) : undefined,
      loadedAt: Date.now(),
    });
  }

  private hydrate(stored: StoredPluginCatalog): PluginCatalog {
    return hydratePluginCatalog(stored, (entry) =>
      this.buildSignal(stored.integrationId, entry),
    );
  }

  private buildSignal(
    integrationId: string,
    entry: CatalogSignalEntry,
  ): PluginSignalAdapter {
    const plugin = this.pluginEntries.find(
      (candidate) => candidate.integrationId === integrationId,
    )?.plugin;
    return buildCatalogSignal({
      plugin,
      integrationId,
      entry,
      getCredential: async (orgId: string) =>
        withoutContextSettings(
          (await this.signalAuthService.getByIntegrationId(
            integrationId,
            orgId,
          )) ?? {},
        ),
    });
  }

  private async refresh(
    orgId: string,
    integrationId: string,
  ): Promise<PluginCatalogRefreshResult> {
    const key = this.key(orgId, integrationId);
    const entry = this.pluginEntries.find(
      (candidate) => candidate.integrationId === integrationId,
    );
    if (!entry || typeof entry.plugin.refreshCatalog !== 'function') {
      throw new CoopError({
        status: 400,
        name: 'IntegrationConfigUnsupportedIntegrationError',
        type: [ErrorType.InvalidUserInput],
        title: 'This integration does not support catalog refresh.',
        shouldErrorSpan: false,
      });
    }

    const previous = await this.repository
      .get(orgId, integrationId)
      .catch(() => this.cache.get(key)?.stored);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const context = {
          integrationId,
          orgId,
          getCredential: async () =>
            withoutContextSettings(
              (await this.signalAuthService.getByIntegrationId(
                integrationId,
                orgId,
              )) ?? {},
            ),
          abortSignal: controller.signal,
        };
        const catalog = validateCatalog(
          await this.withTimeout(
            entry.plugin.refreshCatalog(context),
            controller.signal,
          ),
        );
        const newIds = new Set(catalog.signals.map((it) => it.signalTypeId));
        const collisions = await this.findCollisions(
          integrationId,
          [...newIds],
          orgId,
        );
        if (collisions.length) {
          throw new Error(`COLLISION:${collisions.join(',')}`);
        }
        // Make sure every entry can be built before anything is stored.
        for (const signalEntry of catalog.signals) {
          this.buildSignal(integrationId, signalEntry);
        }
        const oldEntries = previous?.entries ?? [];
        const oldIds = new Set(oldEntries.map((it) => it.signalTypeId));
        const removedEntries = [
          ...(previous?.removedEntries ?? []).filter(
            (it) =>
              !newIds.has(it.signalTypeId) && !oldIds.has(it.signalTypeId),
          ),
          ...oldEntries.filter((it) => !newIds.has(it.signalTypeId)),
        ];
        const fetchedAt = new Date();
        const stored: StoredPluginCatalog = {
          orgId,
          integrationId,
          version: catalog.version,
          entries: catalog.signals,
          removedEntries,
          status: 'OK',
          errorMessage: null,
          fetchedAt,
        };
        await this.repository.save(stored);
        this.setCache(key, stored);
        this.failures.delete(key);
        const result = {
          version: catalog.version,
          signalCount: catalog.signals.length,
          fetchedAt,
          addedSignalTypeIds: [...newIds].filter((id) => !oldIds.has(id)),
          removedSignalTypeIds: [...oldIds].filter((id) => !newIds.has(id)),
        };
        // Refresh listeners are intentionally fire-and-forget: health checks
        // must never delay or break a catalog refresh.
        for (const listener of this.refreshListeners) {
          queueMicrotask(() => {
            try {
              listener({ orgId, integrationId, result });
            } catch {
              // Listener failures are isolated from catalog lifecycle.
            }
          });
        }
        return result;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const reason = safeReason(error);
      this.failures.set(key, Date.now());
      // Keep the last good catalog and record the failure for every instance.
      const failed: StoredPluginCatalog = previous
        ? { ...previous, status: 'ERROR', errorMessage: reason }
        : {
            orgId,
            integrationId,
            version: '',
            entries: [],
            removedEntries: [],
            status: 'ERROR',
            errorMessage: reason,
            fetchedAt: new Date(),
          };
      await this.repository.save(failed).catch(() => undefined);
      this.setCache(key, failed);
      throw new CoopError({
        status: 400,
        name: 'IntegrationCatalogRefreshError',
        type: [ErrorType.InvalidUserInput],
        title: 'Integration catalog refresh failed.',
        detail: reason,
        shouldErrorSpan: false,
        cause: error,
      });
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) throw new Error('TIMEOUT');
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('TIMEOUT')), {
          once: true,
        });
      }),
    ]);
  }

  private async findCollisions(
    integrationId: string,
    ids: string[],
    orgId: string,
  ): Promise<string[]> {
    const collisions = new Set<string>();
    const ownStaticIds = new Set(
      Object.entries(this.staticSignals)
        .filter(([, signal]) => signal.integration === integrationId)
        .map(([id]) => id),
    );
    for (const id of ids) {
      if (this.builtInIds.has(id)) collisions.add(id);
      if (
        !ownStaticIds.has(id) &&
        Object.hasOwn(this.staticSignals, id) &&
        this.staticSignals[id].integration !== integrationId
      )
        collisions.add(id);
    }
    const otherCatalogs = (await this.repository.listForOrg(orgId)).filter(
      (it) => it.integrationId !== integrationId,
    );
    for (const other of otherCatalogs) {
      for (const otherEntry of other.entries) {
        if (ids.includes(otherEntry.signalTypeId)) {
          collisions.add(otherEntry.signalTypeId);
        }
      }
    }
    return [...collisions];
  }

  private key(orgId: string, integrationId: string) {
    return `${orgId}:${integrationId}`;
  }
}

function safeReason(error: unknown): string {
  if (error instanceof Error && error.message === 'TIMEOUT') return 'TIMEOUT';
  if (error instanceof Error && /^COLLISION:/.test(error.message))
    return error.message;
  if (error instanceof Error && error.message.startsWith('INVALID_'))
    return error.message;
  return 'PLUGIN_ERROR';
}
