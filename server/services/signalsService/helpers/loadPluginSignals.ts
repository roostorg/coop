/**
 * Loads signal implementations from integration plugins and wraps them in
 * PluginSignalAdapter so they can be registered and used in rules.
 */

import { createRequire } from 'module';
import path from 'path';

import { isCoopIntegrationPlugin } from '@roostorg/types';
import PluginSignalAdapter, {
  type PluginSignalDescriptor,
} from '../signals/PluginSignalAdapter.js';
import type {
  SignalBase,
  SignalInputType,
} from '../signals/SignalBase.js';
import type { PluginEntry } from '../../integrationRegistry/loadPlugins.js';
import type { SignalAuthService } from '../../signalAuthService/index.js';
import type { SignalOutputType } from '../types/SignalOutputType.js';

export type PluginSignalsByType = Record<
  string,
  SignalBase<SignalInputType, SignalOutputType, unknown, string>
>;

/**
 * For each plugin entry, requires the package, calls createSignals(context) if
 * present, wraps each returned descriptor in PluginSignalAdapter, and returns
 * a map of signalTypeId -> adapter. Uses getByIntegrationId for credential lookup.
 */
export function loadPluginSignals(
  pluginEntries: readonly PluginEntry[],
  signalAuthService: SignalAuthService,
): PluginSignalsByType {
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const byType: PluginSignalsByType = {};

  for (const { packageSpec, integrationId } of pluginEntries) {
    let plugin: unknown;
    try {
      // eslint-disable-next-line security/detect-non-literal-require -- package spec from integrations config (deployment-controlled), not user input
      plugin = require(packageSpec);
    } catch (err: unknown) {
      throw new Error(
        `Failed to load integration package "${packageSpec}" for signals: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const resolved: unknown =
      (plugin as { default?: unknown }).default ?? plugin;
    if (!isCoopIntegrationPlugin(resolved)) continue;
    const createSignals = (resolved as { createSignals?: (ctx: unknown) => unknown[] }).createSignals;
    if (typeof createSignals !== 'function') continue;

    const getCredential = async (orgId: string) =>
      signalAuthService.getByIntegrationId(integrationId, orgId);
    const context = { integrationId, getCredential };
    let signals: unknown[];
    try {
      const raw = createSignals(context);
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
