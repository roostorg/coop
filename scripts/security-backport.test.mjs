import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  alreadyOnBranch,
  backportBody,
  checkLockfileBackport,
  cherryPicks,
  combinedBody,
  combinedReleaseNotes,
  createBranchMessage,
  directDependencyChanges,
  failureComment,
  latestStableTag,
  lockfileDelta,
  lockfilePackages,
  originalCredit,
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

test('releaseNotesSection drops trailing separators', () => {
  assert.equal(
    releaseNotesSection('## Release notes\n- Fix x\n\n---\n\n***\n'),
    '- Fix x',
  );
});

test('originalCredit links the source PR and its author', () => {
  const url = 'https://github.com/roostorg/coop/pull/5';
  assert.equal(
    originalCredit({ number: 5, url, author: { login: 'ann', is_bot: false } }),
    `[#5](${url}) by [@ann](https://github.com/ann)`,
  );
  assert.equal(
    originalCredit({
      number: 5,
      url,
      author: { login: 'app/dependabot', is_bot: true },
    }),
    `[#5](${url}) by [@dependabot[bot]](https://github.com/apps/dependabot)`,
  );
  assert.equal(
    originalCredit({ number: 5, url, author: null }),
    `[#5](${url}) by [@ghost](https://github.com/ghost)`,
  );
});

test('backportBody warns when several packages change', () => {
  const target = { branch: 'release/1.2', next: '1.2.2' };
  const one = backportBody(
    {
      pr: 7,
      sha: 'abc',
      releaseNotes: 'Fix x',
      credit: '[#7](u) by [@a](v)',
      upgrades: [{ name: 'qs', from: ['6.0.0'], to: '6.0.1' }],
      directChanges: ['qs'],
    },
    target,
  );
  assert.match(one, /`qs` 6\.0\.0 → 6\.0\.1/);
  assert.match(
    one,
    /## Release notes\n\nFix x\n<!-- original-credit: \[#7\]\(u\) by \[@a\]\(v\) -->\n$/,
  );
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
      directChanges: ['foo', 'qs'],
    },
    target,
  );
  assert.match(
    many,
    /WARNING\]\n> This changes 2 direct dependencies \(`foo`, `qs`\)/,
  );
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

// The replacers in release-drafter.yml that turn a backport PR's credit
// comment into the release note's credit.
function creditReplacers() {
  const yml = readFileSync(
    new URL('../.github/release-drafter.yml', import.meta.url),
    'utf8',
  );
  const [stripComments, credit] = [
    ...yml.matchAll(/search: '\/(.*original-credit.*)\/(\w*)'$/gm),
  ].map(([, source, flags]) => new RegExp(source, flags));
  assert.ok(stripComments && credit);
  return { stripComments, credit };
}

test("release-drafter.yml credits a backport's release note to the source PR", () => {
  const { stripComments, credit } = creditReplacers();
  const sourceUrl = 'https://github.com/roostorg/coop/pull/11';
  const body = backportBody(
    {
      pr: 11,
      sha: 'abc',
      releaseNotes: '- Fix A\n- Fix B',
      credit: originalCredit({
        number: 11,
        url: sourceUrl,
        author: { login: 'bob', is_bot: false },
      }),
      upgrades: [],
    },
    { branch: 'release/1.2', next: '1.2.4' },
  );
  const notes = body
    .slice(body.search(/^## Release notes$/m) + '## Release notes'.length)
    .replace(stripComments, '')
    .trim();
  // change-template for the backport PR, opened by the app.
  const app = 'https://github.com/apps/coop-backport';
  const line = `${notes} ([#20](https://github.com/roostorg/coop/pull/20) by [@[coop-backport[bot]](${app})](${app}))`;
  assert.equal(
    line.replace(credit, ' ($1)'),
    `- Fix A\n- Fix B ([#11](${sourceUrl}) by [@bob](https://github.com/bob))`,
  );
});

test('release-drafter.yml ignores credit comments not in originalCredit form', () => {
  const { stripComments, credit } = creditReplacers();
  const line =
    '- Fix D\n<!-- original-credit: by [@someone](https://example.com) --> ([#30](https://github.com/roostorg/coop/pull/30) by [@dave](https://github.com/dave))';
  assert.equal(line.replace(credit, ' ($1)'), line);
  assert.equal('Fix <!-- a --> x'.replace(stripComments, ''), 'Fix  x');
});

test('failureComment gives the credit line for a manual backport', () => {
  const comment = failureComment(
    {
      pr: 5,
      reason: 'the cherry-pick conflicts',
      details: '',
      steps: '```bash\n```',
      credit: '[#5](u) by [@ann](v)',
    },
    { branch: 'release/1.2', next: '1.2.4' },
  );
  assert.match(
    comment,
    /^<!-- original-credit: \[#5\]\(u\) by \[@ann\]\(v\) -->$/m,
  );
});

test('cherryPicks maps -x commits to their source and lists the rest', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const log = [
    `c1\x00fix: x\n\n(cherry picked from commit ${a})\n\x01`,
    `c2\x00manual fix\n\x01`,
    `c3\x00fix: y\n\n(cherry picked from commit ${'f'.repeat(40)})\n\x01`,
  ].join('\n');
  const { picks, foreign } = cherryPicks(
    log,
    new Map([
      [a, 1],
      [b, 2],
    ]),
  );
  assert.deepEqual([...picks], [[a, 'c1']]);
  assert.deepEqual(foreign, ['c2', 'c3']);
});

const entry = (pr, releaseNotes, upgrades = []) => ({
  pr,
  sha: String(pr).repeat(40).slice(0, 40),
  releaseNotes,
  credit: `[#${pr}](https://github.com/roostorg/coop/pull/${pr}) by [@u${pr}](https://github.com/u${pr})`,
  upgrades,
});

test('combinedReleaseNotes credits each note, the last through the comment', () => {
  assert.equal(
    combinedReleaseNotes([
      entry(1, 'Fix one'),
      entry(2, ''),
      entry(3, '- Fix three\n- Fix four'),
    ]),
    [
      '- Fix one ([#1](https://github.com/roostorg/coop/pull/1) by [@u1](https://github.com/u1))',
      '- Fix three',
      '- Fix four',
      '<!-- original-credit: [#3](https://github.com/roostorg/coop/pull/3) by [@u3](https://github.com/u3) -->',
    ].join('\n'),
  );
  assert.equal(combinedReleaseNotes([entry(2, '')]), '');
});

test('combinedBody lists each source PR and its lockfile changes', () => {
  const body = combinedBody(
    [entry(1, 'Fix one', [{ name: 'qs', from: ['6.0.0'], to: '6.0.1' }])],
    { branch: 'release/1.2', next: '1.2.4' },
  );
  assert.match(body, /^- #1 \(111111111111\)\n {2}- `qs` 6\.0\.0 → 6\.0\.1$/m);
  assert.match(body, /## Release notes\n\n- Fix one\n<!-- original-credit: /);
});

test('release-drafter.yml credits each note of a combined backport PR', () => {
  const { stripComments, credit } = creditReplacers();
  const body = combinedBody([entry(1, 'Fix one'), entry(3, 'Fix three')], {
    branch: 'release/1.2',
    next: '1.2.4',
  });
  const notes = body
    .slice(body.search(/^## Release notes$/m) + '## Release notes'.length)
    .replace(stripComments, '')
    .trim();
  const app = 'https://github.com/apps/coop-backport';
  const line = `${notes} ([#20](https://github.com/roostorg/coop/pull/20) by [@[coop-backport[bot]](${app})](${app}))`;
  assert.equal(
    line.replace(credit, ' ($1)'),
    [
      '- Fix one ([#1](https://github.com/roostorg/coop/pull/1) by [@u1](https://github.com/u1))',
      '- Fix three ([#3](https://github.com/roostorg/coop/pull/3) by [@u3](https://github.com/u3))',
    ].join('\n'),
  );
});

const importers = (deps) =>
  [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  server:',
    '    dependencies:',
    ...Object.entries(deps).flatMap(([name, version]) => [
      `      ${name.startsWith('@') ? `'${name}'` : name}:`,
      `        specifier: ^${version}`,
      `        version: ${version}(graphql@16.0.0)`,
    ]),
    '',
    'packages:',
    '',
  ].join('\n');

test('directDependencyChanges ignores transitive and peer-only changes', () => {
  const before = importers({ qs: '6.0.0', '@a/b': '1.0.0' });
  assert.deepEqual(
    directDependencyChanges(
      before,
      importers({ qs: '6.0.1', '@a/b': '1.0.0' }).replace(
        '1.0.0(graphql@16.0.0)',
        '1.0.0(graphql@16.1.0)',
      ),
    ),
    ['qs'],
  );
  assert.deepEqual(
    directDependencyChanges(
      before,
      importers({ qs: '6.0.1', '@a/b': '1.1.0' }),
    ),
    ['@a/b', 'qs'],
  );
});

// A stub `gh` for the combined-PR test: serves state.json and logs writes.
const STUB_GH = `#!/usr/bin/env node
const fs = require('node:fs');
const file = process.env.STUB_GH_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\\n' : JSON.stringify(v));
const save = () => fs.writeFileSync(file, JSON.stringify(state));
if (args[0] === 'pr' && args[1] === 'list') {
  if (opt('--label')) return out(state.prs);
  const open = state.combinedPr && opt('--state') === 'open';
  return out(opt('--head') === state.combinedBranch && open ? [state.combinedPr] : []);
}
if (args[0] === 'api') return out([[]]);
state.writes.push(args.slice(0, 2).join(' '));
if (args[1] === 'create') {
  const url = 'https://github.com/x/y/pull/100';
  state.combinedPr = { number: 100, url, body: fs.readFileSync(opt('--body-file'), 'utf8') };
} else if (args[1] === 'edit' && opt('--body-file')) {
  state.combinedPr.body = fs.readFileSync(opt('--body-file'), 'utf8');
} else if (args[1] === 'close') {
  state.combinedPr = null;
}
save();
`;

test('the combined backport PR is built, extended, rebuilt and closed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'security-backport-'));
  const script = fileURLToPath(
    new URL('security-backport.mjs', import.meta.url),
  );
  const stateFile = path.join(dir, 'state.json');
  const branch = 'backport/security-to-release/1.3';
  try {
    mkdirSync(path.join(dir, 'bin'));
    writeFileSync(path.join(dir, 'bin', 'gh'), STUB_GH, { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
      STUB_GH_STATE: stateFile,
      GITHUB_REPOSITORY: 'x/y',
      BACKPORT_PUSH_URL: path.join(dir, 'origin.git'),
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    };
    const sh = (cmd, cwd = path.join(dir, 'work')) =>
      execSync(cmd, { cwd, env, encoding: 'utf8', stdio: 'pipe' }).trim();
    const origin = (cmd) => sh(`git ${cmd}`, path.join(dir, 'origin.git'));
    const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));
    const setState = (f) => {
      const s = state();
      f(s);
      writeFileSync(stateFile, JSON.stringify(s));
    };
    sh(
      'git init -q --bare -b main origin.git && git clone -q origin.git work',
      dir,
    );
    sh('echo base > README && git add README && git commit -qm 1.3.0');
    sh(
      'git tag 1.3.0 && git push -q origin main 1.3.0 HEAD:refs/heads/release/1.3',
    );
    writeFileSync(
      stateFile,
      JSON.stringify({
        prs: [],
        combinedBranch: branch,
        combinedPr: null,
        writes: [],
      }),
    );
    const mergeFix = (n) => {
      sh(
        `git switch -q main && echo ${n} > fix${n}.txt && git add fix${n}.txt`,
      );
      sh(`git commit -qm "fix: fix ${n} (#${n})" && git push -q origin main`);
      const oid = sh('git rev-parse HEAD');
      setState((s) =>
        s.prs.push({
          number: n,
          title: `fix: fix ${n}`,
          body: `## Release notes\n\nFix ${n}\n`,
          url: `https://github.com/x/y/pull/${n}`,
          mergeCommit: { oid },
          mergedAt: `2026-11-18T00:00:0${n}Z`,
          author: { login: `user${n}`, is_bot: false },
          labels: [{ name: 'security-update' }],
        }),
      );
    };
    const label = (n, labels) =>
      setState((s) => {
        s.prs.find((p) => p.number === n).labels = labels.map((name) => ({
          name,
        }));
      });
    // One workflow run: prepare, then publish if the plan has anything to push.
    const runWorkflow = (args = '') => {
      sh(`rm -rf run && git clone -q origin.git run`, dir);
      setState((s) => (s.writes = []));
      const opts = {
        cwd: path.join(dir, 'run'),
        env: { ...env, BACKPORT_WORKDIR: path.join(dir, 'plan') },
      };
      sh(`rm -rf plan`, dir);
      const prepare = spawnSync(
        'node',
        [script, 'prepare', ...args.split(' ').filter(Boolean)],
        { ...opts, encoding: 'utf8' },
      );
      if (prepare.status !== 0)
        return { status: prepare.status, out: prepare.stdout };
      const plan = JSON.parse(
        readFileSync(path.join(dir, 'plan', 'plan.json'), 'utf8'),
      );
      if (plan.combined.changed) {
        const publish = spawnSync('node', [script, 'publish'], {
          ...opts,
          encoding: 'utf8',
        });
        assert.equal(publish.status, 0, publish.stderr);
      }
      return { status: 0, plan, writes: state().writes };
    };
    const picked = () =>
      origin(`log --format=%s release/1.3..${branch}`).split('\n');

    mergeFix(1);
    mergeFix(2);
    let r = runWorkflow();
    assert.deepEqual(r.writes, ['pr create', 'pr edit']);
    assert.deepEqual(picked(), ['fix: fix 2 (#2)', 'fix: fix 1 (#1)']);
    assert.match(state().combinedPr.body, /- Fix 1 \(\[#1\]/);

    r = runWorkflow();
    assert.equal(
      r.plan.combined.changed,
      false,
      'a run with nothing new pushes nothing',
    );

    const before = origin(`rev-parse ${branch}`);
    mergeFix(3);
    runWorkflow();
    assert.doesNotThrow(() =>
      origin(`merge-base --is-ancestor ${before} ${branch}`),
    );
    assert.equal(picked().length, 3);

    label(2, ['security-update', 'no-backport']);
    runWorkflow();
    assert.deepEqual(picked(), ['fix: fix 3 (#3)', 'fix: fix 1 (#1)']);

    sh(
      'git fetch -q && git switch -q -c rel origin/release/1.3 && echo m > m.txt',
    );
    sh(
      'git add m.txt && git commit -qm manual && git push -q origin rel:release/1.3',
    );
    runWorkflow();
    assert.doesNotThrow(() =>
      origin(`merge-base --is-ancestor release/1.3 ${branch}`),
    );
    assert.equal(picked().length, 2);

    label(3, []);
    setState((s) => (s.prs = s.prs.filter((p) => p.number !== 3)));
    runWorkflow();
    assert.deepEqual(
      picked(),
      ['fix: fix 1 (#1)'],
      'an unlabelled fix is dropped',
    );

    mergeFix(4);
    r = runWorkflow('--pr 4');
    assert.deepEqual(
      picked(),
      ['fix: fix 4 (#4)', 'fix: fix 1 (#1)'],
      '--pr keeps the others',
    );

    sh(`git fetch -q origin ${branch} && git switch -q -c hand FETCH_HEAD`);
    sh(
      `echo h > h.txt && git add h.txt && git commit -qm hand && git push -q origin hand:${branch}`,
    );
    const handHead = origin(`rev-parse ${branch}`);
    r = runWorkflow();
    assert.equal(r.status, 1);
    assert.match(r.out, /has commits the workflow did not add/);
    assert.equal(origin(`rev-parse ${branch}`), handHead);

    origin(`update-ref refs/heads/${branch} ${handHead}~1`);
    label(1, ['security-update', 'no-backport']);
    label(4, ['security-update', 'no-backport']);
    r = runWorkflow();
    assert.deepEqual(r.writes, ['pr close']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
