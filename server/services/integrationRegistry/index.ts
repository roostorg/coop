/**
 * Dynamic integration registry: built-in manifests + plugins loaded from
 * integrations.config.json. Single source of truth for available integrations.
 */

import {
  BUILD_IN_MANIFESTS,
  type AvailableIntegration,
  type IntegrationManifestEntry,
} from './integrationManifests.js';
import {
  getIntegrationsConfigPath,
  loadIntegrationsConfig,
} from './loadIntegrationsConfig.js';
import { loadPlugins, type PluginEntry } from './loadPlugins.js';

export type IntegrationRegistry = Readonly<{
  getManifest(id: string): IntegrationManifestEntry | undefined;
  getAvailableIntegrations(): AvailableIntegration[];
  has(id: string): boolean;
  getConfigurableIds(): readonly string[];
  /** Plugin (packageSpec, integrationId) entries for loading plugin signals. */
  getPluginEntries(): readonly PluginEntry[];
  /** Absolute path to main plugin logo (manifest.logoPath). */
  getPluginLogoFilePath(integrationId: string): string | undefined;
  /** Absolute path to "with background" logo (manifest.logoWithBackgroundPath), if set. */
  getPluginLogoWithBackgroundFilePath(integrationId: string): string | undefined;
}>;

function buildRegistry(): IntegrationRegistry {
  const config = loadIntegrationsConfig();
  const configPath = getIntegrationsConfigPath();
  let result: ReturnType<typeof loadPlugins>;
  try {
    result = loadPlugins(config, configPath);
  } catch (err) {
    throw new Error(
      `Integration plugin loading failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const map = new Map<string, IntegrationManifestEntry>();
  for (const [id, entry] of Object.entries(BUILD_IN_MANIFESTS)) {
    map.set(id, entry);
  }
  for (const [id, entry] of result.manifests) {
    map.set(id, entry);
  }
  const configurableIds = Array.from(map.keys());
  const pluginEntries = result.pluginEntries;
  const pluginLogoPaths = result.pluginLogoPaths;
  const pluginLogoWithBackgroundPaths = result.pluginLogoWithBackgroundPaths;

  return {
    getManifest(id: string): IntegrationManifestEntry | undefined {
      return map.get(id);
    },
    getAvailableIntegrations(): AvailableIntegration[] {
      return configurableIds.map((name) => {
        const manifest = map.get(name)!;
        return {
          name,
          title: manifest.title,
          docsUrl: manifest.docsUrl,
          requiresConfig: manifest.requiresConfig,
          logoUrl: manifest.logoUrl,
          logoWithBackgroundUrl: manifest.logoWithBackgroundUrl,
        };
      });
    },
    has(id: string): boolean {
      return map.has(id);
    },
    getConfigurableIds(): readonly string[] {
      return configurableIds;
    },
    getPluginEntries(): readonly PluginEntry[] {
      return pluginEntries;
    },
    getPluginLogoFilePath(integrationId: string): string | undefined {
      return pluginLogoPaths.get(integrationId);
    },
    getPluginLogoWithBackgroundFilePath(integrationId: string): string | undefined {
      return pluginLogoWithBackgroundPaths.get(integrationId);
    },
  };
}

let cachedRegistry: IntegrationRegistry | null = null;

/**
 * Returns the integration registry (built once on first call).
 */
export function getIntegrationRegistry(): IntegrationRegistry {
  if (cachedRegistry == null) {
    cachedRegistry = buildRegistry();
  }
  return cachedRegistry;
}

export {
  BUILD_IN_MANIFESTS,
  type AvailableIntegration,
  type IntegrationManifestEntry,
  type ModelCard,
  type ModelCardField,
  type ModelCardSection,
  type ModelCardSubsection,
} from './integrationManifests.js';
export {
  getIntegrationsConfigPath,
  loadIntegrationsConfig,
} from './loadIntegrationsConfig.js';
export { loadPlugins } from './loadPlugins.js';
