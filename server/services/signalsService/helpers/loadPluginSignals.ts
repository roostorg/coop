/**
 * Loads signal implementations from integration plugins and wraps them in
 * PluginSignalAdapter so they can be registered and used in rules.
 */

import type { PluginSignalContext } from '@roostorg/coop-types';

import { withoutContextSettings } from '../../integrationContextSettings/index.js';
import type { PluginEntry } from '../../integrationRegistry/loadPlugins.js';
import type { SignalAuthService } from '../../signalAuthService/index.js';
import PluginSignalAdapter, {
  type PluginSignalDescriptor,
} from '../signals/PluginSignalAdapter.js';
import type { SignalBase, SignalInputType } from '../signals/SignalBase.js';
import type { SignalOutputType } from '../types/SignalOutputType.js';

export type PluginSignalsByType = Record<
  string,
  SignalBase<SignalInputType, SignalOutputType, unknown, string>
>;

/**
 * For each plugin entry, calls createSignals(context) if present, wraps each
 * returned descriptor in PluginSignalAdapter, and returns a map of
 * signalTypeId -> adapter. Uses getByIntegrationId for credential lookup.
 */
export function loadPluginSignals(
  pluginEntries: readonly PluginEntry[],
  signalAuthService: SignalAuthService,
): PluginSignalsByType {
  const byType: PluginSignalsByType = {};

  for (const { packageSpec, integrationId, plugin } of pluginEntries) {
    const createSignals = plugin.createSignals;
    if (typeof createSignals !== 'function') continue;

    // Unconfigured orgs have always resolved to undefined here, and existing
    // plugins check for it in getDisabledInfo.
    const getCredential = (async (orgId: string) => {
      const config = await signalAuthService.getByIntegrationId(
        integrationId,
        orgId,
      );
      return config && withoutContextSettings(config);
    }) as PluginSignalContext['getCredential'];
    const context = { integrationId, getCredential };
    let signals: unknown[];
    try {
      const raw: unknown = createSignals(context);
      signals = Array.isArray(raw) ? raw : [];
    } catch (err: unknown) {
      throw new Error(
        `Plugin "${packageSpec}" createSignals failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    for (const item of signals) {
      if (
        item == null ||
        typeof item !== 'object' ||
        !('signalTypeId' in item) ||
        !('signal' in item)
      )
        continue;
      const { signalTypeId, signal: descriptor } = item as {
        signalTypeId: string;
        signal: unknown;
      };
      if (typeof signalTypeId !== 'string' || descriptor == null) continue;
      if (signalTypeId in byType) {
        throw new Error(
          `Duplicate plugin signal type "${signalTypeId}" from package "${packageSpec}".`,
        );
      }
      byType[signalTypeId] = new PluginSignalAdapter(
        descriptor as PluginSignalDescriptor,
      );
    }
  }

  return byType;
}
