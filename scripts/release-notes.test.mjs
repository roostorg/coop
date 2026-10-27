import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseReleaseNotes, updateChangelog } from './release-notes.mjs';

test('extracts the release entry, not examples or the following PR sections', () => {
  assert.deepEqual(
    parseReleaseNotes(`## Context
\`\`\`markdown
## Release notes
### Added
- An example, not release notes
\`\`\`
## Release notes
<!-- Instructions are not release notes. -->
### Fixed
- Cancel downloads when requests time out.
## Tests
- Tested downloads.
`),
    {
      category: 'Fixed',
      entries: ['Cancel downloads when requests time out.'],
    },
  );
});

test('missing, whitespace-only, comment-only, and empty template notes are omitted', () => {
  for (const body of [
    null,
    '',
    '## Context\nA fix.',
    '## Release notes\n \r\n## Tests\nTested.',
    '## Release notes\n<!-- Fill this in. -->',
    '## Release notes\n### Added\n- ',
  ]) {
    assert.equal(parseReleaseNotes(body), null);
  }
  assert.equal(
    parseReleaseNotes(
      readFileSync(
        new URL('../.github/PULL_REQUEST_TEMPLATE.md', import.meta.url),
        'utf8',
      ),
    ),
    null,
  );
});

test('rejects nonblank notes without a valid single category or bullet entries', () => {
  for (const content of [
    'Fixed a bug.',
    '### Other\n- A fix.',
    '### Fixed\nA fix.',
    '### Added\n- A feature.\n### Fixed\n- A fix.',
  ]) {
    assert.throws(
      () => parseReleaseNotes(`## Release notes\n${content}`),
      /one category/,
    );
  }
});

const changelog = `# Changelog

## [1.9.0] - 2026-10-01

### Fixed

- Preserve this entry.

## [1.8.0] - 2026-09-01

### Added

- Preserve this older entry.

[1.9.0]: https://github.com/roostorg/coop/compare/1.8.0...1.9.0
[1.8.0]: https://github.com/roostorg/coop/compare/1.7.0...1.8.0
`;
const release = {
  tag_name: '1.10.0',
  published_at: '2026-10-27T23:00:00Z',
  body: '### Added\n\n- A feature ([#42](https://github.com/roostorg/coop/pull/42) by [@author](https://github.com/author)).',
};

test('copies the published notes once, with the date and compare link, preserving history', () => {
  const actual = updateChangelog(changelog, release, 'roostorg/coop');
  assert.equal(
    actual,
    `# Changelog

## [1.10.0] - 2026-10-27

${release.body}

${changelog.slice(changelog.indexOf('## [1.9.0]')).replace('[1.9.0]:', '[1.10.0]: https://github.com/roostorg/coop/compare/1.9.0...1.10.0\n[1.9.0]:')}`,
  );
  assert.equal(updateChangelog(actual, release, 'roostorg/coop'), actual);
  const edited = updateChangelog(
    actual,
    { ...release, body: '### Added\n\n- Corrected notes.' },
    'roostorg/coop',
  );
  assert.equal((edited.match(/^## \[1\.10\.0\]/gm) ?? []).length, 1);
  assert.ok(edited.includes('- Corrected notes.'));
  assert.ok(edited.endsWith(changelog.slice(changelog.indexOf('[1.9.0]:'))));
});

test('updates an existing older release without deleting its successor or comparison links', () => {
  const actual = updateChangelog(
    changelog,
    {
      ...release,
      tag_name: '1.8.0',
      body: '### Added\n\n- Corrected older notes.',
    },
    'roostorg/coop',
  );
  assert.ok(
    actual.includes(
      '## [1.9.0] - 2026-10-01\n\n### Fixed\n\n- Preserve this entry.',
    ),
  );
  assert.ok(actual.includes('- Corrected older notes.'));
  assert.ok(actual.endsWith(changelog.slice(changelog.indexOf('[1.9.0]:'))));
});

test('rejects empty notes, prerelease tags, and out-of-order new entries', () => {
  for (const override of [
    { body: '' },
    { tag_name: '1.10.0-beta.1' },
    { tag_name: '1.7.1' },
    { published_at: null },
  ]) {
    assert.throws(() =>
      updateChangelog(changelog, { ...release, ...override }, 'roostorg/coop'),
    );
  }
});

test('description edits synchronize inclusion and category labels without changing unrelated labels', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'coop-release-notes-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const statePath = join(directory, 'state.json');
  const eventPath = join(directory, 'event.json');
  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: { number: 42, body: 'An outdated event body.' },
    }),
  );
  const gh = join(directory, 'gh');
  writeFileSync(
    gh,
    `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const state = JSON.parse(readFileSync(process.env.STATE_PATH, 'utf8'));
const args = process.argv.slice(2);
let result = null;
if (args[0] === 'label' && args[1] === 'list') result = state.repositoryLabels.map(name => ({name}));
else if (args[0] === 'label' && args[1] === 'create') state.repositoryLabels.push(args[2]);
else if (args[0] === 'api') {
  const method = args[args.indexOf('--method') + 1];
  if (args[1].endsWith('/pulls/42')) result = {body: state.body, labels: state.labels.map(name => ({name}))};
  else if (method === 'POST') state.labels = [...new Set([...state.labels, ...JSON.parse(readFileSync(0, 'utf8')).labels])];
  else if (method === 'DELETE') state.labels = state.labels.filter(name => name !== decodeURIComponent(args[1].split('/').at(-1)));
  else throw new Error('Unexpected API request');
} else throw new Error('Unexpected command');
writeFileSync(process.env.STATE_PATH, JSON.stringify(state));
console.log(JSON.stringify(result));
`,
  );
  chmodSync(gh, 0o755);
  const run = () =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
        'labels',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          STATE_PATH: statePath,
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'roostorg/coop',
        },
      },
    );
  writeFileSync(
    statePath,
    JSON.stringify({
      body: '## Release notes\n### Fixed\n- A fix.',
      labels: ['bug', 'has-release-notes', 'release:added'],
      repositoryLabels: ['has-release-notes', 'release:added'],
    }),
  );
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  let state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.deepEqual(state.labels, ['bug', 'has-release-notes', 'release:fixed']);
  assert.ok(state.repositoryLabels.includes('release:fixed'));

  state.body = '## Release notes\n<!-- Nothing notable. -->';
  writeFileSync(statePath, JSON.stringify(state));
  result = run();
  assert.equal(result.status, 0, result.stderr);
  state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.deepEqual(state.labels, ['bug']);

  state.body = '## Release notes\nMalformed notes.';
  state.labels.push('has-release-notes', 'release:fixed');
  writeFileSync(statePath, JSON.stringify(state));
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /one category/);
  assert.deepEqual(JSON.parse(readFileSync(statePath, 'utf8')).labels, ['bug']);
});
