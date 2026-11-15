import type {
  CatalogSignalEntry,
  CoopIntegrationPlugin,
  PluginSignalDescriptor,
} from '@roostorg/coop-types';

import { makeSignalPermanentError } from '../../../utils/errors.js';
import PluginSignalAdapter from '../signals/PluginSignalAdapter.js';
import type { StoredPluginCatalog } from './pluginCatalogRepository.js';
import type { PluginCatalog } from './pluginCatalogStore.js';
import { findInvalidRuntimeField } from './validatePluginCatalog.js';

/**
 * Rebuilds a runnable signal from a stored catalog entry with the plugin's
 * createCatalogSignal(). Stored entry data is the source of truth for what
 * Coop shows and validates; the plugin only supplies behavior.
 */
export function buildCatalogSignal(opts: {
  plugin: CoopIntegrationPlugin | undefined;
  integrationId: string;
  entry: CatalogSignalEntry;
  getCredential: (orgId: string) => Promise<Record<string, unknown>>;
}): PluginSignalAdapter {
  const { plugin, integrationId, entry, getCredential } = opts;
  if (typeof plugin?.createCatalogSignal !== 'function') {
    throw new Error('INVALID_PLUGIN: createCatalogSignal is required');
  }
  const descriptor: unknown = plugin.createCatalogSignal(entry, {
    integrationId,
    getCredential,
  });
  const invalidField = findInvalidRuntimeField(descriptor);
  if (invalidField != null) {
    throw new Error(
      `INVALID_DESCRIPTOR: ${entry.signalTypeId} has invalid ${invalidField}`,
    );
  }
  const { run, getDisabledInfo, getCost } =
    descriptor as PluginSignalDescriptor;
  const { signalTypeId, metadata: _metadata, ...data } = entry;
  return new PluginSignalAdapter({
    ...data,
    id: { type: signalTypeId },
    integration: integrationId,
    run,
    getDisabledInfo,
    getCost,
  });
}

export function hydratePluginCatalog(
  stored: StoredPluginCatalog,
  build: (entry: CatalogSignalEntry) => PluginSignalAdapter,
): PluginCatalog {
  const signals: Record<string, PluginSignalAdapter> = {};
  for (const entry of stored.entries) {
    try {
      signals[entry.signalTypeId] = build(entry);
    } catch {
      // An entry the plugin can no longer build is left out (signal lookups
      // then fail closed) rather than breaking the whole catalog.
    }
  }
  const tombstones = Object.fromEntries(
    stored.removedEntries.map((entry) => [
      entry.signalTypeId,
      makeTombstone(stored.integrationId, entry),
    ]),
  );
  return {
    version: stored.version,
    signals,
    tombstones,
    fetchedAt: stored.fetchedAt,
    status: stored.status,
    ...(stored.errorMessage != null
      ? { errorMessage: stored.errorMessage }
      : {}),
  };
}

function makeTombstone(integrationId: string, entry: CatalogSignalEntry) {
  return new PluginSignalAdapter({
    id: { type: entry.signalTypeId },
    displayName: entry.displayName,
    description: entry.description,
    docsUrl: entry.docsUrl,
    recommendedThresholds: entry.recommendedThresholds,
    supportedLanguages: entry.supportedLanguages,
    pricingStructure: entry.pricingStructure,
    eligibleInputs: entry.eligibleInputs,
    outputType: entry.outputType,
    getCost: () => 0,
    run: async () => {
      throw makeSignalPermanentError(
        'Signal was removed from the integration catalog.',
        { shouldErrorSpan: false },
      );
    },
    getDisabledInfo: async () => ({
      disabled: true,
      disabledMessage: 'This signal was removed from the integration catalog.',
    }),
    needsMatchingValues: entry.needsMatchingValues,
    eligibleSubcategories: [],
    needsActionPenalties: entry.needsActionPenalties,
    integration: integrationId,
    allowedInAutomatedRules: entry.allowedInAutomatedRules,
  });
}
