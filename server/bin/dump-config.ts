#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Prints this process's effective configuration as JSON, with secrets
 * redacted, for pasting into bug reports. Reads only the environment and the
 * integrations config file; it opens no database or network connections.
 *
 * Usage:
 *   pnpm --filter server run dump-config    # local dev (loads server/.env)
 *   node bin/dump-config.js                 # inside a server or worker image
 */
import stringify from 'safe-stable-stringify';

import { loadIntegrationsConfig } from '../services/integrationRegistry/index.js';
import { buildConfigDump } from '../utils/configDump/buildConfigDump.js';

function enabledIntegrationPackages(): string[] {
  try {
    return loadIntegrationsConfig()
      .integrations.filter((it) => it.enabled !== false)
      .map((it) => it.package);
  } catch (e) {
    // The error can quote file contents, so only its class is printed.
    console.error(
      `Could not read the integrations config (${e instanceof Error ? e.name : 'unknown error'}); "plugins" is empty.`,
    );
    return [];
  }
}

const dump = buildConfigDump({
  env: process.env,
  now: new Date(),
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  integrationPackages: enabledIntegrationPackages(),
});

console.log(stringify(dump, null, 2));
