#!/usr/bin/env node
// Keeps release/x.y, the branch for the next security patch of the latest
// release x.y.z, supplied with every `security`-labelled PR merged to main.
//
//   node scripts/security-backport.mjs prepare [--pr <n>] [--retry]
//   node scripts/security-backport.mjs publish
//
// `prepare` needs only read access: it cherry-picks each pending PR's merge
// commit onto a local backport/<n>-to-release-x.y branch, verifies lockfile
// changes, and writes the plan to $BACKPORT_WORKDIR/plan.json (default
// $RUNNER_TEMP/security-backport). `publish`
// creates release/x.y if it is missing, pushes the backport branches, opens a
// PR for each and comments on the source PR for each failure. Pushes go
// through $BACKPORT_PUSH_URL and API calls use $GH_TOKEN, so the write token
// is only present for `publish`.
//
// It never force-pushes, never pushes to release/x.y once it exists, and
// never modifies pnpm-lock.yaml: a change that does not apply cleanly, or
// whose lockfile changes do not match the source commit's exactly, goes to
// the manual path instead.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'security';
export const failureMarker = (branch) => `<!-- security-backport ${branch} -->`;
const STABLE_TAG = /^(\d+)\.(\d+)\.(\d+)$/;

export function latestStableTag(tags) {
  let best;
  for (const tag of tags) {
    const m = STABLE_TAG.exec(tag.trim());
    if (!m) continue;
    const v = m.slice(1).map(Number);
    if (!best || compareVersions(v, best.v) > 0) best = { tag: tag.trim(), v };
  }
  if (!best) return undefined;
  const [major, minor, patch] = best.v;
  return {
    tag: best.tag,
    branch: `release/${major}.${minor}`,
    next: `${major}.${minor}.${patch + 1}`,
  };
}

function compareVersions(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function backportBranchName(pr, releaseBranch) {
  return `backport/${pr}-to-${releaseBranch}`;
}

// The `name@version` keys of a v9 pnpm-lock.yaml's `packages:` section.
export function lockfilePackages(text) {
  const out = new Set();
  let inPackages = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) {
      inPackages = line.startsWith('packages:');
      continue;
    }
    if (!inPackages) continue;
    const m = /^ {2}(?:'([^']+)'|([^\s'][^:]*)):\s*(?:\{\})?$/.exec(line);
    if (m) out.add(m[1] ?? m[2]);
  }
  return out;
}

function nameOf(key) {
  return key.slice(0, key.indexOf('@', 1));
}

export function lockfileDelta(before, after) {
  const a = lockfilePackages(before);
  const b = lockfilePackages(after);
  return {
    added: [...b].filter((k) => !a.has(k)).sort(),
    removed: [...a].filter((k) => !b.has(k)).sort(),
  };
}

// Compares the backport's lockfile change with the source commit's. The
// backport may only add package versions the source commit added, and must
// add the source's new version of every package it upgrades that the release
// branch already has.
export function checkLockfileBackport({ source, backport, branchBefore }) {
  const problems = [];
  const sourceAdded = new Set(source.added);
  for (const key of backport.added) {
    if (!sourceAdded.has(key)) {
      problems.push(`${key} is not in the source PR's lockfile changes`);
    }
  }
  const sourceRemovedNames = new Set(source.removed.map(nameOf));
  const branchNames = new Set([...branchBefore].map(nameOf));
  const backportAdded = new Set(backport.added);
  for (const key of source.added) {
    const name = nameOf(key);
    if (
      sourceRemovedNames.has(name) &&
      branchNames.has(name) &&
      !branchBefore.has(key) &&
      !backportAdded.has(key)
    ) {
      problems.push(`${key} from the source PR is missing`);
    }
  }
  return problems;
}

export function upgradedPackages(delta) {
  const removed = new Map();
  for (const key of delta.removed) {
    const name = nameOf(key);
    removed.set(name, [
      ...(removed.get(name) ?? []),
      key.slice(name.length + 1),
    ]);
  }
  const out = [];
  for (const key of delta.added) {
    const name = nameOf(key);
    const version = key.slice(name.length + 1);
    out.push({ name, from: removed.get(name) ?? [], to: version });
  }
  return out;
}

// The `## Release notes` section of a PR body, without HTML comments.
export function releaseNotesSection(body) {
  const lines = (body ?? '').replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => /^## Release notes\s*$/i.test(l));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end))
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

// Whether `log` (git log --format=%s%n%b of the release branch since it
// diverged from main) already contains PR `pr` or commit `sha`.
export function alreadyOnBranch(log, pr, sha) {
  return (
    log.includes(`(cherry picked from commit ${sha})`) ||
    new RegExp(`^.*\\(#${pr}\\)\\s*$`, 'm').test(log)
  );
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 256 * 1024 * 1024,
    ...opts,
  }).trim();
}

function tryRun(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...opts,
  });
  return {
    ok: r.status === 0,
    out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(),
  };
}

function gh(args) {
  return run('gh', args);
}

function ghJson(args) {
  return JSON.parse(gh(args) || 'null');
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function workdirPath() {
  return (
    process.env.BACKPORT_WORKDIR ??
    path.join(env('RUNNER_TEMP'), 'security-backport')
  );
}

function gitShow(rev, file, cwd) {
  const r = tryRun('git', ['show', `${rev}:${file}`], { cwd });
  return r.ok ? r.out : '';
}

function commitTouches(sha, file) {
  return run('git', [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    '-m',
    '--first-parent',
    sha,
  ])
    .split('\n')
    .includes(file);
}

function manualSteps(pr, sha, target, parents) {
  const branch = backportBranchName(pr, target.branch);
  return [
    '```bash',
    'git fetch origin',
    `git switch -c ${branch} origin/${target.branch}`,
    `git cherry-pick -x ${parents > 1 ? '-m 1 ' : ''}${sha}`,
    '# resolve conflicts; for pnpm-lock.yaml follow "Cherry-picking deterministically"',
    `git push -u origin ${branch}`,
    `gh pr create --base ${target.branch} --label ${LABEL}`,
    '```',
  ].join('\n');
}

function prepare({ prFilter, retry }) {
  const repo = env('GITHUB_REPOSITORY');
  const workdir = workdirPath();
  mkdirSync(workdir, { recursive: true });
  run('git', [
    'fetch',
    '--quiet',
    '--tags',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
  ]);

  const target = latestStableTag(run('git', ['tag', '--list']).split('\n'));
  if (!target) throw new Error('no x.y.z release tag found');
  const branchExists = tryRun('git', [
    'fetch',
    '--quiet',
    'origin',
    `+refs/heads/${target.branch}:refs/remotes/origin/${target.branch}`,
  ]).ok;
  const base = branchExists ? `origin/${target.branch}` : target.tag;
  const plan = {
    repo,
    target: {
      ...target,
      exists: branchExists,
      baseSha: run('git', ['rev-parse', `${base}^{commit}`]),
    },
    backports: [],
    failures: [],
    skipped: [],
  };
  console.log(
    `Latest release ${target.tag}; next security patch ${target.next} from ${target.branch}` +
      (branchExists ? '' : ` (to be created at ${target.tag})`),
  );

  const forkPoint = run('git', ['merge-base', 'origin/main', base]);
  const since = run('git', ['log', '-1', '--format=%cI', forkPoint]).slice(
    0,
    10,
  );
  const branchLog = run('git', [
    'log',
    '--format=%s%n%b',
    `${forkPoint}..${base}`,
  ]);

  const prs = ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--base',
    'main',
    '--state',
    'merged',
    '--label',
    LABEL,
    '--search',
    `merged:>=${since}`,
    '--limit',
    '200',
    '--json',
    'number,title,body,url,mergeCommit,mergedAt,author',
  ])
    .filter((p) => !prFilter || p.number === prFilter)
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));

  for (const pr of prs) {
    const sha = pr.mergeCommit?.oid;
    const branch = backportBranchName(pr.number, target.branch);
    const skip = (reason) => {
      plan.skipped.push({ pr: pr.number, reason });
      console.log(`#${pr.number}: skip, ${reason}`);
    };
    if (!sha) {
      skip('no merge commit');
      continue;
    }
    if (tryRun('git', ['merge-base', '--is-ancestor', sha, base]).ok) {
      skip(`already in ${base}`);
      continue;
    }
    if (alreadyOnBranch(branchLog, pr.number, sha)) {
      skip(`already cherry-picked onto ${target.branch}`);
      continue;
    }
    const existing = ghJson([
      'pr',
      'list',
      '--repo',
      repo,
      '--head',
      branch,
      '--state',
      'all',
      '--json',
      'number,state,url',
    ]);
    if (existing.length > 0) {
      skip(
        `backport PR ${existing.map((p) => `${p.url} (${p.state.toLowerCase()})`).join(', ')}`,
      );
      continue;
    }
    // A branch without a PR is from a run that failed to open the PR, or a
    // manual backport: verify it and open the PR for it.
    const existingRef = tryRun('git', [
      'fetch',
      '--quiet',
      'origin',
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
    ]).ok
      ? `origin/${branch}`
      : undefined;
    if (!retry) {
      const comments = ghJson([
        'api',
        `repos/${repo}/issues/${pr.number}/comments`,
        '--paginate',
        '--slurp',
      ]).flat();
      if (comments.some((c) => c.body.includes(failureMarker(target.branch)))) {
        skip(
          'backport already reported as failed; rerun with --retry after fixing',
        );
        continue;
      }
    }
    const result = backportOne({ pr, sha, target, base, workdir, existingRef });
    if (result.skip) skip(result.skip);
    else if (result.ok) plan.backports.push(result);
    else plan.failures.push(result);
  }

  writeFileSync(
    path.join(workdir, 'plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
  );
  console.log(
    `${plan.backports.length} to open, ${plan.failures.length} failed, ${plan.skipped.length} skipped`,
  );
}

function backportOne({ pr, sha, target, base, workdir, existingRef }) {
  const branch = backportBranchName(pr.number, target.branch);
  const dir = path.join(workdir, `pr-${pr.number}`);
  const parents =
    run('git', ['rev-list', '--parents', '-n', '1', sha]).split(' ').length - 1;
  const fail = (reason, details = '') => {
    tryRun('git', ['cherry-pick', '--abort'], { cwd: dir });
    console.log(`#${pr.number}: FAILED, ${reason}`);
    return {
      ok: false,
      pr: pr.number,
      url: pr.url,
      sha,
      branch,
      reason,
      details,
      steps: manualSteps(pr.number, sha, target, parents),
    };
  };

  if (existingRef) {
    run('git', ['worktree', 'add', '--quiet', '-B', branch, dir, existingRef]);
    const log = run('git', ['log', '--format=%s%n%b', `${base}..HEAD`], {
      cwd: dir,
    });
    if (
      !tryRun('git', ['merge-base', '--is-ancestor', base, 'HEAD'], {
        cwd: dir,
      }).ok
    ) {
      return fail(
        `branch ${branch} exists but is not based on ${target.branch}`,
      );
    }
    if (!alreadyOnBranch(log, pr.number, sha)) {
      return fail(`branch ${branch} exists but does not contain ${sha}`);
    }
  } else {
    run('git', ['worktree', 'add', '--quiet', '-B', branch, dir, base]);
  }
  const pick = existingRef
    ? { ok: true }
    : tryRun(
        'git',
        ['cherry-pick', '-x', ...(parents > 1 ? ['-m', '1'] : []), sha],
        { cwd: dir },
      );
  if (!pick.ok) {
    const conflicted = tryRun(
      'git',
      ['diff', '--name-only', '--diff-filter=U'],
      { cwd: dir },
    ).out;
    if (!conflicted && /nothing to commit|empty/i.test(pick.out)) {
      tryRun('git', ['cherry-pick', '--abort'], { cwd: dir });
      return { skip: `the change is already on ${target.branch}` };
    }
    return fail(
      conflicted ? 'the cherry-pick conflicts' : 'the cherry-pick failed',
      conflicted
        ? `Conflicting files:\n\n${conflicted
            .split('\n')
            .map((f) => `- \`${f}\``)
            .join('\n')}`
        : pick.out,
    );
  }

  let upgrades = [];
  if (commitTouches(sha, 'pnpm-lock.yaml')) {
    const source = lockfileDelta(
      gitShow(`${sha}^1`, 'pnpm-lock.yaml'),
      gitShow(sha, 'pnpm-lock.yaml'),
    );
    const beforeText = gitShow(base, 'pnpm-lock.yaml');
    const backport = lockfileDelta(
      beforeText,
      gitShow('HEAD', 'pnpm-lock.yaml', dir),
    );
    upgrades = upgradedPackages(backport);
    const problems = checkLockfileBackport({
      source,
      backport,
      branchBefore: lockfilePackages(beforeText),
    });
    if (problems.length > 0) {
      return fail(
        "its lockfile changes differ from the source PR's",
        problems.map((p) => `- ${p}`).join('\n'),
      );
    }
    const frozen = tryRun(
      'pnpm',
      [
        'install',
        '--frozen-lockfile',
        '--lockfile-only',
        '--ignore-scripts',
        '--ignore-pnpmfile',
      ],
      { cwd: dir },
    );
    if (!frozen.ok) {
      return fail(
        '`pnpm install --frozen-lockfile` fails on the result',
        frozen.out.slice(-3000),
      );
    }
    const checker = path.join(
      process.cwd(),
      'scripts',
      'check-lockfile-backport.mjs',
    );
    if (existsSync(checker)) {
      const newer = tryRun('node', [checker, 'origin/main'], { cwd: dir });
      if (!newer.ok) {
        return fail(
          "the lockfile has versions newer than main's",
          newer.out.slice(-3000),
        );
      }
    }
  }

  const head = run('git', ['rev-parse', 'HEAD'], { cwd: dir });
  console.log(`#${pr.number}: ready as ${branch} (${head.slice(0, 12)})`);
  return {
    ok: true,
    pushed: Boolean(existingRef),
    pr: pr.number,
    url: pr.url,
    title: pr.title,
    author: pr.author?.login,
    sha,
    branch,
    head,
    releaseNotes: releaseNotesSection(pr.body),
    upgrades,
  };
}

export function backportBody(b, target) {
  const lines = [
    `Backport of #${b.pr} to \`${target.branch}\` for ${target.next}, opened by the security backport workflow.`,
    '',
    `Cherry-picked from ${b.sha} with \`git cherry-pick -x\`. Merge with a merge commit or rebase so that the \`(cherry picked from commit …)\` line stays on \`${target.branch}\`.`,
  ];
  const packages = new Set(b.upgrades.map((u) => u.name));
  if (b.upgrades.length > 0) {
    lines.push(
      '',
      "Lockfile changes match the source PR's exactly:",
      '',
      ...b.upgrades.map(
        (u) =>
          `- \`${u.name}\` ${u.from.length ? `${u.from.join(', ')} → ` : 'new: '}${u.to}`,
      ),
    );
  }
  if (packages.size > 1) {
    lines.push(
      '',
      `> [!WARNING]`,
      `> This changes ${packages.size} packages. If the source PR grouped security updates with other updates, keep only the security updates (see "Cherry-picking deterministically" in the security release runbook) before marking this ready.`,
    );
  }
  lines.push('', '## Release notes', '', b.releaseNotes);
  return `${lines.join('\n').trimEnd()}\n`;
}

function failureComment(f, target) {
  return [
    failureMarker(target.branch),
    `The security backport workflow could not backport this PR to \`${target.branch}\` for ${target.next}: ${f.reason}.`,
    '',
    f.details,
    '',
    'Backport it by hand, following the security release runbook:',
    '',
    f.steps,
    '',
    `Or, once the cause is fixed, rerun the **Security backports** workflow with \`pr: ${f.pr}\` and \`retry: true\`.`,
  ].join('\n');
}

function publish() {
  const workdir = workdirPath();
  const pushUrl = env('BACKPORT_PUSH_URL');
  const plan = JSON.parse(
    readFileSync(path.join(workdir, 'plan.json'), 'utf8'),
  );
  const { repo, target } = plan;

  if (!target.exists) {
    // Fails rather than overwrites if someone created the branch since.
    run('git', [
      'push',
      pushUrl,
      `${target.baseSha}:refs/heads/${target.branch}`,
    ]);
    console.log(`Created ${target.branch} at ${target.tag}`);
  }

  for (const b of plan.backports) {
    if (!b.pushed) {
      run('git', ['push', pushUrl, `${b.head}:refs/heads/${b.branch}`]);
    }
    const bodyFile = path.join(workdir, `body-${b.pr}.md`);
    writeFileSync(bodyFile, backportBody(b, target));
    const draft = new Set(b.upgrades.map((u) => u.name)).size > 1;
    const url = gh([
      'pr',
      'create',
      '--repo',
      repo,
      '--base',
      target.branch,
      '--head',
      b.branch,
      '--title',
      b.title,
      '--body-file',
      bodyFile,
      ...(draft ? ['--draft'] : []),
    ]);
    // release-notes.yml's autolabeler only runs on PRs to main, and the
    // release/x.y draft only collects PRs labelled has-release-notes.
    const labels = b.releaseNotes ? `${LABEL},has-release-notes` : LABEL;
    const labelled = tryRun('gh', [
      'pr',
      'edit',
      url,
      '--repo',
      repo,
      '--add-label',
      labels,
    ]);
    if (!labelled.ok)
      console.log(`::warning::could not label ${url}: ${labelled.out}`);
    console.log(`#${b.pr}: opened ${url}`);
  }

  for (const f of plan.failures) {
    const bodyFile = path.join(workdir, `comment-${f.pr}.md`);
    writeFileSync(bodyFile, failureComment(f, target));
    gh([
      'pr',
      'comment',
      String(f.pr),
      '--repo',
      repo,
      '--body-file',
      bodyFile,
    ]);
    console.log(
      `::error::#${f.pr} could not be backported to ${target.branch}: ${f.reason}`,
    );
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const rows = [
      `### Security backports to \`${target.branch}\` (next: ${target.next})`,
      '',
      ...plan.backports.map((b) => `- Opened backport of #${b.pr}`),
      ...plan.failures.map((f) => `- **Failed** #${f.pr}: ${f.reason}`),
      ...plan.skipped.map((s) => `- Skipped #${s.pr}: ${s.reason}`),
    ];
    writeFileSync(summary, `${rows.join('\n')}\n`, { flag: 'a' });
  }
  if (plan.failures.length > 0) process.exitCode = 1;
}

function main(argv) {
  const [command, ...rest] = argv;
  let prFilter;
  let retry = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--pr' && /^\d+$/.test(rest[i + 1] ?? ''))
      prFilter = Number(rest[++i]);
    else if (rest[i] === '--retry') retry = true;
    else throw new Error(`unknown argument: ${rest[i]}`);
  }
  if (command === 'prepare') prepare({ prFilter, retry });
  else if (command === 'publish') publish();
  else
    throw new Error(
      'usage: security-backport.mjs prepare [--pr <n>] [--retry] | publish',
    );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
