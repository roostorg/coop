import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { CONFIG_CATALOG } from './catalog.js';

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const SKIPPED_DIRS = new Set([
  'node_modules',
  'transpiled',
  'reports',
  'e2e',
  'test',
]);

const ENV_READ_PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g,
  /(?:safeGetEnv\w*|isEnvTrue|getEnvVarOrWarn)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
];
const ENV_DESTRUCTURE_PATTERN = /\{([^{}]*)\}\s*=\s*process\.env\b/g;

function sourceFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks the repo's own source tree
  return readdirSync(dir, { withFileTypes: true }).flatMap((it) => {
    const fullPath = path.join(dir, it.name);
    if (it.isDirectory()) {
      return SKIPPED_DIRS.has(it.name) ? [] : sourceFiles(fullPath);
    }
    return it.name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(it.name)
      ? [fullPath]
      : [];
  });
}

function envVarsReadIn(source: string): string[] {
  const directReads = ENV_READ_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1]),
  );
  const destructuredReads = [
    ...source.matchAll(ENV_DESTRUCTURE_PATTERN),
  ].flatMap((match) =>
    match[1]
      .split(',')
      .map((it) => it.split(':')[0].trim())
      .filter((it) => /^[A-Z][A-Z0-9_]*$/.test(it)),
  );
  return [...directReads, ...destructuredReads];
}

describe('CONFIG_CATALOG', () => {
  test('covers every env var the server and workers read', () => {
    const catalogued = new Set(
      Object.values(CONFIG_CATALOG).flatMap((specs) =>
        specs.map((it) => it.key),
      ),
    );

    const missing = sourceFiles(serverRoot).flatMap((file) =>
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file comes from the walk above
      envVarsReadIn(readFileSync(file, 'utf-8'))
        .filter((name) => !catalogued.has(name))
        .map((name) => `${name} (${path.relative(serverRoot, file)})`),
    );

    expect([...new Set(missing)].sort()).toEqual([]);
  });

  test('lists each key once', () => {
    const keys = Object.values(CONFIG_CATALOG).flatMap((specs) =>
      specs.map((it) => it.key),
    );
    expect(keys.length).toBe(new Set(keys).size);
  });
});
