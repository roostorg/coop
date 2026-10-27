// Converts the V8 coverage the API server writes under the E2E suite
// (NODE_V8_COVERAGE) into lcov, the same way @vitest/coverage-v8 does for the
// unit and integration suites, so Codecov merges the uploads line for line.
//
// Usage, from server/: node e2e/v8-coverage-to-lcov.mjs <v8-dir> <report-dir>
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCoverageMap } from '@vitest/istanbul-lib-coverage';
import {
  createContext,
  create as createReport,
} from '@vitest/istanbul-lib-report';
import convert from 'ast-v8-to-istanbul';
import { parseAstAsync } from 'vitest/node';

const [v8Dir, reportDir] = process.argv.slice(2);
if (!v8Dir || !reportDir) {
  console.error('usage: v8-coverage-to-lcov.mjs <v8-dir> <report-dir>');
  process.exit(1);
}

const serverDir = path.resolve(import.meta.dirname, '..');
const transpiledDir = path.join(serverDir, 'transpiled');

// Mirrors the coverage exclude list in vitest.config.ts, except that bin/ is
// kept: the server and worker entry points are only covered here.
const excludedSources = [
  /^(test|e2e)\//,
  /\.(test|spec)\.ts$/,
  /\.d\.ts$/,
  /^[^/]*\.config\.ts$/,
  /^graphql\/generated\.ts$/,
];

function isReportedSource(file) {
  const relative = path.relative(serverDir, file);
  return (
    !relative.startsWith('..') &&
    relative.endsWith('.ts') &&
    !excludedSources.some((pattern) => pattern.test(relative))
  );
}

async function toIstanbul(file, functions) {
  const code = await readFile(file, 'utf8');
  const url = pathToFileURL(file).href;
  const sourceMap = JSON.parse(await readFile(`${file}.map`, 'utf8'));
  sourceMap.sources = sourceMap.sources.map(
    (source) => new URL(source, url).href,
  );
  return convert({
    code,
    sourceMap,
    ast: parseAstAsync(code),
    coverage: { url, functions },
  });
}

const coverageMap = createCoverageMap({});
const loaded = new Set();

for (const name of await readdir(v8Dir)) {
  const { result } = JSON.parse(await readFile(path.join(v8Dir, name), 'utf8'));
  for (const script of result) {
    if (!script.url.startsWith('file:')) continue;
    const file = fileURLToPath(script.url);
    if (!file.startsWith(transpiledDir + path.sep)) continue;
    loaded.add(file);
    coverageMap.merge(await toIstanbul(file, script.functions));
  }
}

// Files the suite never loaded are reported at 0%, as vitest does.
for (const entry of await readdir(transpiledDir, { recursive: true })) {
  const file = path.join(transpiledDir, entry);
  if (!file.endsWith('.js') || loaded.has(file)) continue;
  coverageMap.merge(await toIstanbul(file, []));
}

coverageMap.filter(isReportedSource);

const context = createContext({ coverageMap, dir: reportDir });
// Repo-relative lcov paths, as in vitest.config.ts.
createReport('lcov', { projectRoot: path.dirname(serverDir) }).execute(context);
createReport('text-summary').execute(context);
