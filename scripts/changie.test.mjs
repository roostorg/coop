import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const cli = join(root, 'node_modules/changie/npm/changie.js');
let directory;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'coop-changie-'));
  copyFileSync(join(root, '.changie.yaml'), join(directory, '.changie.yaml'));
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

function changie(...args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('generates PR and author links for one, two, or three authors', () => {
  changie(
    'new',
    '--kind',
    'Fixed',
    '--body',
    'Single author',
    '--custom',
    'pr=123',
    '--custom',
    'authors=alice',
    '--interactive=false',
  );
  changie(
    'new',
    '--kind',
    'Fixed',
    '--body',
    'Two authors',
    '--custom',
    'pr=456',
    '--custom',
    '"authors=alice,bob"',
    '--interactive=false',
  );
  changie(
    'new',
    '--kind',
    'Fixed',
    '--body',
    'Three authors',
    '--custom',
    'pr=789',
    '--custom',
    '"authors= @alice , bob, @charlie "',
    '--interactive=false',
  );

  const entries = changie('batch', '1.2.0', '--dry-run')
    .split('\n')
    .filter((line) => line.startsWith('- '));
  assert.deepEqual(entries, [
    '- Single author ([#123](https://github.com/roostorg/coop/pull/123) by [@alice](https://github.com/alice))',
    '- Two authors ([#456](https://github.com/roostorg/coop/pull/456) by [@alice](https://github.com/alice), [@bob](https://github.com/bob))',
    '- Three authors ([#789](https://github.com/roostorg/coop/pull/789) by [@alice](https://github.com/alice), [@bob](https://github.com/bob), [@charlie](https://github.com/charlie))',
  ]);
});

test('allows a deferred PR number but refuses to release without it', () => {
  changie(
    'new',
    '--kind',
    'Fixed',
    '--body',
    'Pending PR',
    '--custom',
    'authors=alice',
    '--interactive=false',
  );
  const fragments = readdirSync(join(directory, '.changes/unreleased'));
  assert.throws(() => changie('batch', '1.2.0'), /Set the fragment's PR/);
  assert.deepEqual(
    readdirSync(join(directory, '.changes/unreleased')),
    fragments,
  );
});

for (const authors of ['', '   ', 'alice, ,bob']) {
  test(`refuses release notes with an empty author: ${JSON.stringify(authors)}`, () => {
    const created = spawnSync(
      process.execPath,
      [
        cli,
        'new',
        '--kind',
        'Fixed',
        '--body',
        'Missing author',
        '--custom',
        'pr=123',
        '--custom',
        `"authors=${authors}"`,
        '--interactive=false',
      ],
      { cwd: directory, encoding: 'utf8' },
    );
    if (created.status !== 0) {
      assert.match(created.stdout + created.stderr, /input length too short/);
    } else {
      assert.throws(
        () => changie('batch', '1.2.0', '--dry-run'),
        /Authors must contain/,
      );
    }
  });
}
