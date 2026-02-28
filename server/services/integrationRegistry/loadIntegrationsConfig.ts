/**
 * Loads and validates the adopters' integrations config file.
 * Path: INTEGRATIONS_CONFIG_PATH env or cwd/integrations.config.json.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import type { CoopIntegrationsConfig } from '@roostorg/types';

import { jsonParse } from '../../utils/encoding.js';
import type { JsonOf } from '../../utils/encoding.js';

function getConfigPath(): string {
  const envPath = process.env.INTEGRATIONS_CONFIG_PATH;
  if (envPath != null && envPath !== '') {
    return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
  }
  const cwdPath = path.join(process.cwd(), 'integrations.config.json');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from cwd/env, not user input
  if (existsSync(cwdPath)) return cwdPath;
  // When started from repo root (e.g. npm run start), cwd has no integrations.config.json; try server/
  const serverPath = path.join(process.cwd(), 'server', 'integrations.config.json');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from cwd, not user input
  if (existsSync(serverPath)) return serverPath;
  return cwdPath;
}

/**
 * Returns the path to the integrations config file (for resolving relative package specs).
 */
export function getIntegrationsConfigPath(): string {
  return getConfigPath();
}

/**
 * Loads CoopIntegrationsConfig from the configured path.
 * Returns { integrations: [] } if the file is missing (built-ins only).
 */
export function loadIntegrationsConfig(): CoopIntegrationsConfig {
  const configPath = getConfigPath();
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path from getConfigPath (env/cwd), not user input
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = jsonParse(raw as JsonOf<Record<string, unknown>>);
    if (typeof parsed !== 'object') {
      return { integrations: [] };
    }
    const o = parsed;
    const integrations = Array.isArray(o.integrations) ? o.integrations : [];
    const entries = integrations.filter(
      (e): e is { package: string; enabled?: boolean; config?: Record<string, unknown> } =>
        e != null && typeof e === 'object' && typeof (e as Record<string, unknown>).package === 'string',
    );
    return { integrations: entries };
  } catch (err: unknown) {
    if (err != null && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return { integrations: [] };
    }
    throw err;
  }
}
