// Run: node --test scripts/check-lockfile-backport.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareLockfiles, parseLockfile } from './check-lockfile-backport.mjs';

const lockfile = (keys) =>
  [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    dependencies:',
    '      foo:',
    '        specifier: ^1.0.0',
    '        version: 1.0.0',
    '',
    'packages:',
    '',
    ...keys.flatMap((k) => [
      `  ${k}:`,
      '    resolution: {integrity: sha512-x}',
      '',
    ]),
    'snapshots:',
    '',
    "  'ignored@9.9.9(peer@1.0.0)':",
    '    dependencies:',
    '      nested: 1.0.0',
    '',
  ].join('\n');

const ids = (entries) => entries.map((e) => `${e.name}@${e.version}`);

test('parses scoped, quoted and multi-version keys from packages only', () => {
  const parsed = parseLockfile(
    lockfile(["'@scope/pkg@1.2.3'", 'plain@2.0.0', 'plain@3.1.0']),
  );
  assert.deepEqual(
    [...parsed].map(([n, v]) => [n, [...v]]),
    [
      ['@scope/pkg', ['1.2.3']],
      ['plain', ['2.0.0', '3.1.0']],
    ],
  );
});

test('rejects lockfile versions other than 9.x', () => {
  assert.throws(
    () => parseLockfile("lockfileVersion: '6.0'\n"),
    /not supported/,
  );
});

test('flags a version newer than the base in the same line', () => {
  const base = parseLockfile(lockfile(['a@1.2.0', 'b@1.0.0']));
  const head = parseLockfile(lockfile(['a@1.3.0', 'b@1.0.0']));
  assert.deepEqual(ids(compareLockfiles(base, head).newer), ['a@1.3.0']);
});

test('checks each version line of a multi-version package separately', () => {
  const base = parseLockfile(lockfile(['a@1.2.0', 'a@2.5.0']));
  const head = parseLockfile(lockfile(['a@1.3.0', 'a@2.4.0']));
  const { newer, added } = compareLockfiles(base, head);
  assert.deepEqual(ids(newer), ['a@1.3.0']);
  assert.deepEqual(added, []);
});

test('treats each 0.x minor as its own line', () => {
  const base = parseLockfile(lockfile(['a@0.2.5', 'a@0.4.0']));
  const head = parseLockfile(lockfile(['a@0.2.6', 'a@0.3.0']));
  const { newer, added } = compareLockfiles(base, head);
  assert.deepEqual(ids(newer), ['a@0.2.6']);
  assert.deepEqual(ids(added), ['a@0.3.0']);
});

test('flags a new line above every base version as newer', () => {
  const base = parseLockfile(lockfile(['a@1.9.0']));
  const head = parseLockfile(lockfile(['a@2.0.0']));
  assert.deepEqual(ids(compareLockfiles(base, head).newer), ['a@2.0.0']);
});

test('ignores older versions in a line the base has', () => {
  const base = parseLockfile(lockfile(['a@1.5.0']));
  const head = parseLockfile(lockfile(['a@1.4.0']));
  assert.deepEqual(compareLockfiles(base, head), { newer: [], added: [] });
});

test('orders prereleases below their release', () => {
  const base = parseLockfile(lockfile(['a@1.0.0-rc.2', 'b@1.0.0']));
  const head = parseLockfile(lockfile(['a@1.0.0-rc.10', 'b@1.0.0-rc.1']));
  assert.deepEqual(ids(compareLockfiles(base, head).newer), ['a@1.0.0-rc.10']);
});

test('reports packages missing from the base, and non-semver versions, as added', () => {
  const base = parseLockfile(lockfile(['a@1.0.0']));
  const head = parseLockfile(
    lockfile(['a@1.0.0', 'new@1.0.0', 'local@file:client/eslint']),
  );
  const { newer, added } = compareLockfiles(base, head);
  assert.deepEqual(newer, []);
  assert.deepEqual(ids(added), ['local@file:client/eslint', 'new@1.0.0']);
});
