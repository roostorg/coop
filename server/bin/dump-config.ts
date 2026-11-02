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
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import stringify from 'safe-stable-stringify';

import { loadIntegrationsConfig } from '../services/integrationRegistry/index.js';
import { buildConfigDump } from '../utils/configDump/buildConfigDump.js';
import { jsonParse, type JsonOf } from '../utils/encoding.js';

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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// The script runs from /app/server/bin in images and server/transpiled/bin in
// dev, so server/package.json is one or two levels up.
function serverPackageVersion(): string | null {
  for (const candidate of ['../package.json', '../../package.json']) {
    const pkgPath = path.join(scriptDir, candidate);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed paths next to this script
    if (existsSync(pkgPath)) {
      const pkg = jsonParse(
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed paths next to this script
        readFileSync(pkgPath, 'utf-8') as JsonOf<{
          name?: string;
          version?: string;
        }>,
      );
      if (pkg.name === 'server') {
        return pkg.version ?? null;
      }
    }
  }
  return null;
}

function checkoutCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: scriptDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Images have no git or no repository.
    return null;
  }
}

const dump = buildConfigDump({
  env: process.env,
  now: new Date(),
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  integrationPackages: enabledIntegrationPackages(),
  appVersion: serverPackageVersion(),
  checkoutCommit: checkoutCommit(),
});

console.log(stringify(dump, null, 2));
