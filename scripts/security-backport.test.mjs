import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  alreadyOnBranch,
  backportBody,
  checkLockfileBackport,
  createBranchMessage,
  latestStableTag,
  lockfileDelta,
  lockfilePackages,
  releaseNotesSection,
} from './security-backport.mjs';

const lockfile = (...keys) =>
  [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '  .:',
    '    dependencies:',
    '      foo:',
    '        specifier: ^1.0.0',
    '',
    'packages:',
    '',
    ...keys.flatMap((k) => [
      k.startsWith('@') ? `  '${k}':` : `  ${k}:`,
      '    resolution: {integrity: x}',
      '',
    ]),
    'snapshots:',
    '',
    '  not-a-package@9.9.9: {}',
    '',
  ].join('\n');

test('latestStableTag picks the highest x.y.z and ignores other tags', () => {
  assert.deepEqual(
    latestStableTag([
      '1.0',
      '1.2.0',
      '1.10.0-rc.1',
      '1.2.1',
      '1.1.0-alpha',
      '0.1',
    ]),
    {
      tag: '1.2.1',
      branch: 'release/1.2',
      next: '1.2.2',
    },
  );
  assert.equal(latestStableTag(['1.9.3', '1.10.0']).branch, 'release/1.10');
  assert.equal(latestStableTag(['v1.0.0']), undefined);
});

test('lockfilePackages reads only the packages section', () => {
  assert.deepEqual(
    [...lockfilePackages(lockfile('foo@1.0.0', '@scope/bar@2.0.0(baz@1.0.0)'))],
    ['foo@1.0.0', '@scope/bar@2.0.0(baz@1.0.0)'],
  );
});

test('a backport that matches the source change passes', () => {
  const source = lockfileDelta(
    lockfile('foo@1.0.5', 'qs@6.0.0'),
    lockfile('foo@1.0.6', 'qs@6.0.0'),
  );
  const before = lockfile('foo@1.0.2', 'qs@5.0.0');
  const backport = lockfileDelta(before, lockfile('foo@1.0.6', 'qs@5.0.0'));
  assert.deepEqual(
    checkLockfileBackport({
      source,
      backport,
      branchBefore: lockfilePackages(before),
    }),
    [],
  );
});

test('a version the source PR did not add is reported', () => {
  const source = lockfileDelta(lockfile('foo@1.0.5'), lockfile('foo@1.0.6'));
  const before = lockfile('foo@1.0.5', 'bar@1.0.0');
  const backport = lockfileDelta(before, lockfile('foo@1.0.6', 'bar@1.1.0'));
  assert.deepEqual(
    checkLockfileBackport({
      source,
      backport,
      branchBefore: lockfilePackages(before),
    }),
    ["bar@1.1.0 is not in the source PR's lockfile changes"],
  );
});

test('a missing fixed version is reported', () => {
  const source = lockfileDelta(
    lockfile('foo@1.0.5', 'bar@1.0.0'),
    lockfile('foo@1.0.6', 'bar@1.0.1'),
  );
  const before = lockfile('foo@1.0.5', 'bar@1.0.0');
  const backport = lockfileDelta(before, lockfile('foo@1.0.6', 'bar@1.0.0'));
  assert.deepEqual(
    checkLockfileBackport({
      source,
      backport,
      branchBefore: lockfilePackages(before),
    }),
    ['bar@1.0.1 from the source PR is missing'],
  );
});

test('upgrades of packages the branch does not have are not required', () => {
  const source = lockfileDelta(lockfile('new@1.0.0'), lockfile('new@1.0.1'));
  const before = lockfile('foo@1.0.0');
  assert.deepEqual(
    checkLockfileBackport({
      source,
      backport: { added: [], removed: [] },
      branchBefore: lockfilePackages(before),
    }),
    [],
  );
});

test('alreadyOnBranch matches the -x trailer or the PR number in a subject', () => {
  const log =
    'fix(deps): bump qs (#1522)\n\n(cherry picked from commit abc123)\nchore: other\n';
  assert.ok(alreadyOnBranch(log, 1, 'abc123'));
  assert.ok(alreadyOnBranch(log, 1522, 'zzz'));
  assert.ok(!alreadyOnBranch(log, 152, 'zzz'));
  assert.ok(!alreadyOnBranch('see #1522 for details\n', 1522, 'zzz'));
});

test('releaseNotesSection drops comments and later sections', () => {
  const body =
    '## Context\r\nx\r\n\r\n## Release notes\r\n<!-- help -->\r\n- Update qs to 6.14.1\r\n\r\n## Checklist\r\n- [ ] y\r\n';
  assert.equal(releaseNotesSection(body), '- Update qs to 6.14.1');
  assert.equal(releaseNotesSection('no section'), '');
});

test('releaseNotesSection leaves no comment opener behind', () => {
  assert.equal(
    releaseNotesSection('## Release notes\nFix x <!-<!-- a -->- hidden'),
    'Fix x',
  );
  assert.equal(
    releaseNotesSection('## Release notes\nFix x\n<!-- unclosed'),
    'Fix x',
  );
});

test('backportBody warns when several packages change', () => {
  const target = { branch: 'release/1.2', next: '1.2.2' };
  const one = backportBody(
    {
      pr: 7,
      sha: 'abc',
      releaseNotes: 'Fix x',
      upgrades: [{ name: 'qs', from: ['6.0.0'], to: '6.0.1' }],
    },
    target,
  );
  assert.match(one, /`qs` 6\.0\.0 → 6\.0\.1/);
  assert.match(one, /## Release notes\n\nFix x\n$/);
  assert.doesNotMatch(one, /WARNING/);
  const many = backportBody(
    {
      pr: 7,
      sha: 'abc',
      releaseNotes: '',
      upgrades: [
        { name: 'qs', from: ['6.0.0'], to: '6.0.1' },
        { name: 'foo', from: [], to: '1.0.0' },
      ],
    },
    target,
  );
  assert.match(many, /WARNING/);
});

test('the command in the missing-branch warning creates the branch at the tag', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'security-backport-'));
  try {
    const sh = (cmd, cwd = path.join(dir, 'clone')) =>
      execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
    sh('git init -q --bare origin.git && git init -q clone', dir);
    sh('git remote add origin ../origin.git');
    sh('git -c user.name=t -c user.email=t@t commit -q --allow-empty -m 1');
    sh('git -c user.name=t -c user.email=t@t tag -a 1.3.0 -m 1.3.0');
    const target = latestStableTag(['1.3.0']);
    const message = createBranchMessage(target);
    sh(message.slice(message.indexOf('git push')));
    assert.equal(
      sh('git rev-parse release/1.3', path.join(dir, 'origin.git')),
      sh('git rev-parse HEAD'),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
