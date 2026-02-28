/**
 * Loads integration plugin packages from the config and maps their manifests
 * to the server's IntegrationManifestEntry shape. Can also collect plugin
 * entries for later signal loading (createSignals).
 */

import fs from 'node:fs';
import { createRequire } from 'module';
import path from 'path';

import {
  assertModelCardHasRequiredSections,
  isCoopIntegrationPlugin,
} from '@roostorg/types';
import type { CoopIntegrationsConfig } from '@roostorg/types';

import type {
  IntegrationManifestEntry,
  ModelCard,
} from './integrationManifests.js';

export type PluginManifestMap = Map<string, IntegrationManifestEntry>;

export type PluginEntry = Readonly<{ packageSpec: string; integrationId: string }>;

export type LoadPluginsResult = Readonly<{
  manifests: PluginManifestMap;
  pluginEntries: readonly PluginEntry[];
  /** integrationId -> absolute path to main logo (manifest.logoPath). */
  pluginLogoPaths: ReadonlyMap<string, string>;
  /** integrationId -> absolute path to "with background" logo (manifest.logoWithBackgroundPath). */
  pluginLogoWithBackgroundPaths: ReadonlyMap<string, string>;
}>;

const INTEGRATION_LOGOS_PATH_PREFIX = '/api/v1/integration-logos';

function findPackageRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is from require.resolve (package entry), not user input
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

/**
 * Loads each enabled integration package from config, validates as
 * CoopIntegrationPlugin, and returns manifest map and list of plugin entries
 * (packageSpec + integrationId) for later signal loading.
 * Skips entries with enabled: false. Throws on invalid plugin or duplicate id.
 * Package specs in config (e.g. "../coop-integration-example") are resolved
 * relative to the directory containing the config file, so the server works
 * whether started from server/ or repo root.
 */
/* eslint-disable complexity -- logo path resolution and fallbacks add branches; kept in one place for clarity. */
export function loadPlugins(
  config: CoopIntegrationsConfig,
  configPath: string,
): LoadPluginsResult {
  const require = createRequire(path.join(path.dirname(configPath), 'package.json'));
  const map = new Map<string, IntegrationManifestEntry>();
  const pluginEntries: PluginEntry[] = [];
  const pluginLogoPaths = new Map<string, string>();
  const pluginLogoWithBackgroundPaths = new Map<string, string>();

  for (const entry of config.integrations) {
    if (entry.enabled === false) continue;
    const packageSpec = entry.package;
    let plugin: unknown;
    try {
      // eslint-disable-next-line security/detect-non-literal-require -- package spec from integrations config (deployment-controlled), not user input
      plugin = require(packageSpec);
    } catch (err: unknown) {
      throw new Error(
        `Failed to load integration package "${packageSpec}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const resolved: unknown =
      (plugin as { default?: unknown }).default ?? plugin;
    if (!isCoopIntegrationPlugin(resolved)) {
      throw new Error(
        `Integration package "${packageSpec}" does not export a valid CoopIntegrationPlugin (manifest with id, name, version, requiresConfig).`,
      );
    }
    const manifest = resolved.manifest;
    const id = manifest.id;
    if (map.has(id)) {
      throw new Error(
        `Duplicate integration id "${id}" from package "${packageSpec}".`,
      );
    }
    if (manifest.modelCard != null) {
      assertModelCardHasRequiredSections(manifest.modelCard as ModelCard);
    }

    let logoUrl = manifest.logoUrl;
    let logoWithBackgroundUrl = manifest.logoWithBackgroundUrl;
    const logoPath = (manifest as { logoPath?: string }).logoPath;
    const logoWithBackgroundPath = (manifest as { logoWithBackgroundPath?: string }).logoWithBackgroundPath;
    const entryPath = require.resolve(packageSpec);
    const packageRoot = findPackageRoot(path.dirname(entryPath));
    const packageRootResolved = path.resolve(packageRoot);

    const resolveLogoPath = (
      relPath: string,
    ): { fullPathResolved: string; found: boolean; pathToUse: string } => {
      const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\))+/, '');
      const fullPath = path.join(packageRoot, normalized);
      const fullPathResolved = path.resolve(fullPath);
      if (
        !fullPathResolved.startsWith(packageRootResolved) ||
        path.relative(packageRootResolved, fullPathResolved).startsWith('..')
      ) {
        throw new Error(
          `Integration "${id}" logo path must be inside the package: ${relPath}`,
        );
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fullPathResolved is under package root from manifest path
      let found = fs.existsSync(fullPathResolved);
      let pathToUse = fullPathResolved;
      if (!found) {
        const altPath = path.join(packageRoot, relPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- altPath under package root from manifest
        if (fs.existsSync(altPath)) {
          pathToUse = path.resolve(altPath);
          found = true;
        }
      }
      return { fullPathResolved, found, pathToUse };
    };

    // logoPath → plain logo (no background), served at /id as logoUrl — used on integrations page.
    // logoWithBackgroundPath → logo with background, served at /id/with-background as logoWithBackgroundUrl — used in signal modals.
    if (logoPath != null && logoPath.length > 0) {
      const logoUrlPath = `${INTEGRATION_LOGOS_PATH_PREFIX}/${id}`;
      const { fullPathResolved, found, pathToUse } = resolveLogoPath(logoPath);
      if (found) {
        pluginLogoPaths.set(id, pathToUse);
        logoUrl = logoUrlPath;
        if (logoWithBackgroundUrl == null && logoWithBackgroundPath == null)
          logoWithBackgroundUrl = logoUrlPath;
      } else {
        logoUrl = logoUrlPath;
        if (logoWithBackgroundUrl == null && logoWithBackgroundPath == null)
          logoWithBackgroundUrl = logoUrlPath;
        // eslint-disable-next-line no-console -- plugin load; SafeTracer may not be available yet.
        console.warn(
          `[integrations] Logo file not found for "${id}": tried ${fullPathResolved} (manifest.logoPath: ${logoPath})`,
        );
      }
    }
    if (logoWithBackgroundPath != null && logoWithBackgroundPath.length > 0) {
      const withBgUrlPath = `${INTEGRATION_LOGOS_PATH_PREFIX}/${id}/with-background`;
      const { fullPathResolved, found, pathToUse } = resolveLogoPath(logoWithBackgroundPath);
      if (found) {
        pluginLogoWithBackgroundPaths.set(id, pathToUse);
        logoWithBackgroundUrl = withBgUrlPath;
      } else {
        logoWithBackgroundUrl = withBgUrlPath;
        // eslint-disable-next-line no-console -- plugin load; SafeTracer may not be available yet.
        console.warn(
          `[integrations] Logo-with-background file not found for "${id}": tried ${fullPathResolved} (manifest.logoWithBackgroundPath: ${logoWithBackgroundPath})`,
        );
      }
    }

    const serverEntry: IntegrationManifestEntry = {
      title: manifest.name,
      docsUrl: manifest.docsUrl ?? '',
      requiresConfig: manifest.requiresConfig,
      modelCard: manifest.modelCard as ModelCard,
      modelCardLearnMoreUrl: (manifest as { modelCardLearnMoreUrl?: string })
        .modelCardLearnMoreUrl,
      logoUrl,
      logoWithBackgroundUrl,
    };
    // Plugin manifest may omit modelCard; we require it for display.
    if ((serverEntry as { modelCard?: ModelCard }).modelCard == null) {
      throw new Error(
        `Integration "${id}" (${packageSpec}) must provide a modelCard with at least "modelDetails" and "technicalIntegration" sections.`,
      );
    }
    map.set(id, serverEntry);
    pluginEntries.push({ packageSpec, integrationId: id });
  }

  return { manifests: map, pluginEntries, pluginLogoPaths, pluginLogoWithBackgroundPaths };
}
