#!/usr/bin/env node
// Keeps release/x.y, the branch for the next security patch of the latest
// release x.y.z, supplied with every `security-update`-labelled PR merged to
// main.
//
//   node scripts/security-backport.mjs prepare [--pr <n>] [--retry]
//   node scripts/security-backport.mjs publish
//
// `prepare` needs only read access: it cherry-picks each pending PR's merge
// commit onto backport/security-to-release/x.y, the branch of one running
// draft PR for the release, verifies lockfile changes, and writes the plan to
// $BACKPORT_WORKDIR/plan.json (default $RUNNER_TEMP/security-backport). A PR
// that changes several packages gets its own backport/<n>-to-release/x.y PR
// instead. If release/x.y doesn't exist, it warns with the command a
// maintainer runs to create it and plans nothing. `publish` pushes the
// branches, opens or updates the PRs and comments on the source PR for each
// failure. Pushes go through $BACKPORT_PUSH_URL and API calls use $GH_TOKEN,
// so the write token is only present for `publish`.
//
// It force-pushes only backport/security-to-release/x.y, with a lease, never
// pushes to release/*, and never modifies pnpm-lock.yaml: a change that does
// not apply cleanly, or whose lockfile changes do not match the source
// commit's exactly, goes to the manual path instead.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'security-update';
export const DECLINE_LABEL = 'no-backport';
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

// The `## Release notes` section of a PR body, without HTML comments or
// trailing separators.
export function releaseNotesSection(body) {
  const lines = (body ?? '').replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => /^## Release notes\s*$/i.test(l));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  let text = (end === -1 ? rest : rest.slice(0, end)).join('\n');
  // Repeat until stable: removing one comment can join `<!-` and `-` into a
  // new `<!--`. An unclosed `<!--` would hide the rest of the backport body.
  for (let prev; prev !== text;) {
    prev = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  }
  return text
    .replace(/<!--[\s\S]*$/, '')
    .replace(/((?:^|\n)[ \t]*(?:-{3,}|\*{3,}|_{3,})\s*)+$/, '')
    .trim();
}

// The source PR and its author, in change-template's format. The backport PR
// carries it in an `original-credit` comment, which release-drafter.yml puts
// in place of the backport PR's own credit.
export function originalCredit({ number, url, author }) {
  if (author?.is_bot) {
    const app = author.login.replace(/^app\//, '');
    return `[#${number}](${url}) by [@${app}[bot]](https://github.com/apps/${app})`;
  }
  const login = author?.login ?? 'ghost';
  return `[#${number}](${url}) by [@${login}](https://github.com/${login})`;
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

export function creditComment(credit) {
  return `<!-- original-credit: ${credit} -->`;
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

export function createBranchMessage(target) {
  return (
    `${target.branch} does not exist, so nothing is backported. ` +
    `A maintainer who can create release branches runs: ` +
    `git push origin '${target.tag}^{commit}:refs/heads/${target.branch}'`
  );
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
  const branchExists = fetchBranch(target.branch);
  const plan = {
    repo,
    target,
    combined: undefined,
    backports: [],
    failures: [],
    skipped: [],
  };
  const writePlan = () =>
    writeFileSync(
      path.join(workdir, 'plan.json'),
      `${JSON.stringify(plan, null, 2)}\n`,
    );
  console.log(
    `Latest release ${target.tag}; next security patch ${target.next} from ${target.branch}`,
  );
  if (!branchExists) {
    // The release/* ruleset lets only its bypass actors create branches.
    const message = createBranchMessage(target);
    console.log(`::warning::${message}`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) writeFileSync(summary, `${message}\n`, { flag: 'a' });
    writePlan();
    return;
  }
  const base = `origin/${target.branch}`;

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
    'number,title,body,url,mergeCommit,mergedAt,author,labels',
  ]).sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));

  const combined = openCombined({ repo, target, base, prs });
  plan.combined = combined.state;
  if (combined.foreign.length > 0) {
    // Rebuilding the branch would drop commits someone else pushed.
    console.log(
      `::error::${combined.state.branch} has commits the workflow did not add (${combined.foreign.join(', ')}); remove them, or merge or close its PR, then rerun`,
    );
    process.exitCode = 1;
    writePlan();
    return;
  }

  for (const pr of prs) {
    const sha = pr.mergeCommit?.oid;
    const skip = (reason) => {
      plan.skipped.push({ pr: pr.number, reason });
      console.log(`#${pr.number}: skip, ${reason}`);
    };
    const wasIncluded = combined.included.has(pr.number);
    if (prFilter && pr.number !== prFilter && !wasIncluded) continue;
    if (!sha) {
      skip('no merge commit');
      continue;
    }
    if (pr.labels?.some((l) => l.name === DECLINE_LABEL)) {
      skip(`labelled ${DECLINE_LABEL}`);
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
    if (wasIncluded && !combined.rebuild) {
      combined.add(pr, combined.included.get(pr.number));
      console.log(`#${pr.number}: already in ${combined.state.branch}`);
      continue;
    }
    const branch = backportBranchName(pr.number, target.branch);
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
    // A backport/<n> branch without a PR is from a run that failed to open
    // the PR, or a manual backport: verify it and open its own PR.
    if (fetchBranch(branch)) {
      const result = backportOne({
        pr,
        sha,
        target,
        base,
        workdir,
        existingRef: `origin/${branch}`,
      });
      record(plan, result, skip);
      continue;
    }
    if (!retry && !wasIncluded && failureReported(repo, pr, target)) {
      skip(
        'backport already reported as failed; rerun with --retry after fixing',
      );
      continue;
    }
    const result = combined.pick(pr, sha, workdir);
    if (result.separate) {
      // Grouped updates are reviewed on their own; see backportBody.
      record(plan, backportOne({ pr, sha, target, base, workdir }), skip);
    } else if (result.ok) {
      combined.add(pr, result);
    } else {
      record(plan, result, skip);
    }
  }

  combined.finish();
  writePlan();
  console.log(
    `${combined.state.entries.length} in ${combined.state.branch}${combined.state.changed ? ' (changed)' : ''}, ${plan.backports.length} separate PRs to open, ${plan.failures.length} failed, ${plan.skipped.length} skipped`,
  );
}

function record(plan, result, skip) {
  if (result.skip) skip(result.skip);
  else if (result.ok) plan.backports.push(result);
  else plan.failures.push(result);
}

function fetchBranch(branch) {
  return tryRun('git', [
    'fetch',
    '--quiet',
    'origin',
    `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
  ]).ok;
}

function failureReported(repo, pr, target) {
  const comments = ghJson([
    'api',
    `repos/${repo}/issues/${pr.number}/comments`,
    '--paginate',
    '--slurp',
  ]).flat();
  return comments.some((c) => c.body.includes(failureMarker(target.branch)));
}

// The source commits that `log` (git log --format=%H%x00%B%x01) cherry-picked
// with -x, and the commits that are not such a cherry-pick of `known`.
export function cherryPicks(log, known) {
  const picks = new Map();
  const foreign = [];
  for (const entry of log.split('\x01')) {
    const [commit, message = ''] = entry.trim().split('\x00');
    if (!commit) continue;
    const source = [
      ...message.matchAll(/\(cherry picked from commit ([0-9a-f]{40})\)/g),
    ].at(-1)?.[1];
    if (source && known.has(source)) picks.set(source, commit);
    else foreign.push(commit.slice(0, 12));
  }
  return { picks, foreign };
}

// The running PR that collects every backport to release/x.y. The branch is
// rebuilt from release/x.y when release/x.y has moved or a fix in it was
// declined, and otherwise only gains commits.
function openCombined({ repo, target, base, prs }) {
  const branch = combinedBranchName(target.branch);
  const dir = path.join(workdirPath(), 'combined');
  const remote = fetchBranch(branch)
    ? run('git', ['rev-parse', `origin/${branch}`])
    : null;
  const [open] = ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--head',
    branch,
    '--base',
    target.branch,
    '--state',
    'open',
    '--json',
    'number,url,body',
  ]);
  const bySha = new Map(
    prs.filter((p) => p.mergeCommit?.oid).map((p) => [p.mergeCommit.oid, p]),
  );
  const included = new Map();
  let foreign = [];
  let rebuild = true;
  if (open && remote) {
    const log = run('git', [
      'log',
      '--reverse',
      '--format=%H%x00%B%x01',
      `${base}..${remote}`,
    ]);
    const found = cherryPicks(log, bySha);
    foreign = found.foreign;
    for (const [source, commit] of found.picks) {
      included.set(bySha.get(source).number, {
        upgrades: commitUpgrades(commit),
      });
    }
    const declined = [...found.picks.keys()].some((s) =>
      bySha.get(s).labels?.some((l) => l.name === DECLINE_LABEL),
    );
    rebuild =
      declined ||
      !tryRun('git', ['merge-base', '--is-ancestor', base, remote]).ok;
  }
  const state = {
    branch,
    pr: open ? { number: open.number, url: open.url } : null,
    remote,
    head: null,
    entries: [],
    changed: false,
    close: false,
    body: '',
    currentBody: open?.body?.replace(/\r/g, '') ?? '',
  };
  if (foreign.length > 0) return { state, foreign, included, rebuild };
  run('git', [
    'worktree',
    'add',
    '--quiet',
    '-B',
    branch,
    dir,
    rebuild ? base : remote,
  ]);
  console.log(
    `${branch}: ${rebuild ? `building from ${target.branch}` : `adding to ${remote.slice(0, 12)}`}`,
  );
  return {
    state,
    foreign,
    included,
    rebuild,
    add(pr, result) {
      state.entries.push({
        pr: pr.number,
        url: pr.url,
        title: pr.title,
        sha: pr.mergeCommit.oid,
        credit: originalCredit(pr),
        releaseNotes: releaseNotesSection(pr.body),
        upgrades: result.upgrades ?? [],
      });
    },
    pick(pr, sha) {
      const before = run('git', ['rev-parse', 'HEAD'], { cwd: dir });
      const result = pickAndCheck({ pr, sha, target, dir, before });
      const packages = new Set((result.upgrades ?? []).map((u) => u.name));
      if (!result.ok || packages.size > 1) {
        tryRun('git', ['cherry-pick', '--abort'], { cwd: dir });
        run('git', ['reset', '--quiet', '--hard', before], { cwd: dir });
      }
      if (result.ok && packages.size > 1) return { separate: true };
      if (result.ok) console.log(`#${pr.number}: added to ${branch}`);
      return result;
    },
    finish() {
      state.head = run('git', ['rev-parse', 'HEAD'], { cwd: dir });
      state.body = combinedBody(state.entries, target);
      state.close = state.entries.length === 0 && Boolean(state.pr);
      state.changed =
        state.close ||
        (state.entries.length > 0 &&
          (state.head !== remote ||
            !state.pr ||
            state.body.trimEnd() !== state.currentBody.trimEnd()));
    },
  };
}

export function combinedBranchName(releaseBranch) {
  return `backport/security-to-${releaseBranch}`;
}

function parentCount(sha) {
  return (
    run('git', ['rev-list', '--parents', '-n', '1', sha]).split(' ').length - 1
  );
}

function failure({ pr, sha, target }, reason, details = '') {
  console.log(`#${pr.number}: FAILED, ${reason}`);
  return {
    ok: false,
    pr: pr.number,
    url: pr.url,
    sha,
    reason,
    details,
    steps: manualSteps(pr.number, sha, target, parentCount(sha)),
    credit: originalCredit(pr),
  };
}

// The packages whose versions `commit` changes in pnpm-lock.yaml.
function commitUpgrades(commit, cwd) {
  if (!commitTouches(commit, 'pnpm-lock.yaml')) return [];
  return upgradedPackages(
    lockfileDelta(
      gitShow(`${commit}^`, 'pnpm-lock.yaml', cwd),
      gitShow(commit, 'pnpm-lock.yaml', cwd),
    ),
  );
}

// Cherry-picks `sha` onto the worktree `dir` at `before` and checks its
// lockfile changes. Leaves a failed cherry-pick for the caller to clean up.
function pickAndCheck({ pr, sha, target, dir, before, picked = false }) {
  const parents = parentCount(sha);
  const fail = (reason, details) =>
    failure({ pr, sha, target }, reason, details);
  const pick = picked
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
    const beforeText = gitShow(before, 'pnpm-lock.yaml', dir);
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
  return { ok: true, upgrades };
}

// A backport in its own PR from backport/<n>-to-release/x.y: a fix that
// changes several packages, or a branch someone pushed by hand.
function backportOne({ pr, sha, target, base, workdir, existingRef }) {
  const branch = backportBranchName(pr.number, target.branch);
  const dir = path.join(workdir, `pr-${pr.number}`);
  run('git', [
    'worktree',
    'add',
    '--quiet',
    '-B',
    branch,
    dir,
    existingRef ?? base,
  ]);
  const withBranch = (result) => ({ ...result, branch });
  if (existingRef) {
    const log = run('git', ['log', '--format=%s%n%b', `${base}..HEAD`], {
      cwd: dir,
    });
    const problem = !tryRun(
      'git',
      ['merge-base', '--is-ancestor', base, 'HEAD'],
      { cwd: dir },
    ).ok
      ? `branch ${branch} exists but is not based on ${target.branch}`
      : !alreadyOnBranch(log, pr.number, sha)
        ? `branch ${branch} exists but does not contain ${sha}`
        : undefined;
    if (problem) return withBranch(failure({ pr, sha, target }, problem));
  }
  const result = pickAndCheck({
    pr,
    sha,
    target,
    dir,
    before: base,
    picked: Boolean(existingRef),
  });
  if (!result.ok) {
    tryRun('git', ['cherry-pick', '--abort'], { cwd: dir });
    return result.skip ? result : withBranch(result);
  }
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: dir });
  console.log(`#${pr.number}: ready as ${branch} (${head.slice(0, 12)})`);
  return {
    ok: true,
    pushed: Boolean(existingRef),
    pr: pr.number,
    url: pr.url,
    title: pr.title,
    credit: originalCredit(pr),
    sha,
    branch,
    head,
    releaseNotes: releaseNotesSection(pr.body),
    upgrades: result.upgrades,
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
  lines.push(
    '',
    '## Release notes',
    '',
    ...(b.releaseNotes ? [b.releaseNotes] : []),
    creditComment(b.credit),
  );
  return `${lines.join('\n')}\n`;
}

export function failureComment(f, target) {
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
    "In the backport PR, copy this PR's `## Release notes` section, end it with this line so the release notes credit this PR and its author, and add the `has-release-notes` label:",
    '',
    '```markdown',
    creditComment(f.credit),
    '```',
    '',
    `Or, once the cause is fixed, rerun the **Security backports** workflow with \`pr: ${f.pr}\` and \`retry: true\`.`,
  ].join('\n');
}

// Release notes for several source PRs in one PR body. Each note but the
// last carries its credit inline; the last is credited through the
// `original-credit` comment, which replaces the combined PR's own credit.
export function combinedReleaseNotes(entries) {
  const noted = entries.filter((e) => e.releaseNotes);
  if (noted.length === 0) return '';
  const notes = noted.map((e, i) => {
    const text = /^[-*][ \t]/.test(e.releaseNotes)
      ? e.releaseNotes
      : `- ${e.releaseNotes}`;
    return i < noted.length - 1 ? `${text} (${e.credit})` : text;
  });
  return [...notes, creditComment(noted.at(-1).credit)].join('\n');
}

export function combinedBody(entries, target) {
  const lines = [
    `Security fixes from \`main\` for ${target.next}, cherry-picked onto \`${target.branch}\` with \`git cherry-pick -x\` by the security backport workflow. Each run adds new \`security-update\` PRs and rewrites this description, so don't push to this branch or edit this description.`,
    '',
    `Merge with **Rebase and merge**, so that each \`(cherry picked from commit …)\` line stays on \`${target.branch}\`.`,
    '',
    ...entries.flatMap((e) => [
      `- #${e.pr} (${e.sha.slice(0, 12)})`,
      ...e.upgrades.map(
        (u) =>
          `  - \`${u.name}\` ${u.from.length ? `${u.from.join(', ')} → ` : 'new: '}${u.to}`,
      ),
    ]),
    '',
    `To leave a fix out, label its PR \`${DECLINE_LABEL}\`; the next run rebuilds this branch without it. To change a release note, edit the source PR's \`## Release notes\` section and rerun the **Security backports** workflow.`,
    '',
    '## Release notes',
    '',
  ];
  const notes = combinedReleaseNotes(entries);
  if (notes) lines.push(notes);
  return `${lines.join('\n').trimEnd()}\n`;
}

function publish() {
  const workdir = workdirPath();
  const pushUrl = env('BACKPORT_PUSH_URL');
  const plan = JSON.parse(
    readFileSync(path.join(workdir, 'plan.json'), 'utf8'),
  );
  const { repo, target, combined } = plan;
  const summaryRows = [];

  if (combined?.close) {
    gh([
      'pr',
      'close',
      String(combined.pr.number),
      '--repo',
      repo,
      '--comment',
      'Every fix in this PR was declined or is already on the release branch, so the security backport workflow closed it.',
    ]);
    summaryRows.push(`- Closed ${combined.pr.url}: nothing left in it`);
  } else if (combined?.changed) {
    if (combined.head !== combined.remote) {
      // The workflow owns this branch: rebuilding it after release/x.y moves
      // or a fix is declined rewrites it, and the lease refuses to overwrite
      // anything pushed since prepare read it.
      run('git', [
        'push',
        `--force-with-lease=refs/heads/${combined.branch}:${combined.remote ?? ''}`,
        pushUrl,
        `${combined.head}:refs/heads/${combined.branch}`,
      ]);
    }
    const bodyFile = path.join(workdir, 'body-combined.md');
    writeFileSync(bodyFile, combined.body);
    const url =
      combined.pr?.url ??
      gh([
        'pr',
        'create',
        '--repo',
        repo,
        '--base',
        target.branch,
        '--head',
        combined.branch,
        '--title',
        `fix: backport security fixes to ${target.branch} for ${target.next}`,
        '--body-file',
        bodyFile,
        '--draft',
      ]);
    if (combined.pr) {
      gh(['pr', 'edit', url, '--repo', repo, '--body-file', bodyFile]);
    }
    label(
      repo,
      url,
      combined.entries.some((e) => e.releaseNotes),
    );
    summaryRows.push(
      `- ${combined.pr ? 'Updated' : 'Opened'} ${url} with ${combined.entries.map((e) => `#${e.pr}`).join(', ')}`,
    );
    console.log(`${combined.branch}: ${url}`);
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
    label(repo, url, Boolean(b.releaseNotes));
    summaryRows.push(`- Opened ${url}, a separate backport of #${b.pr}`);
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
    summaryRows.push(`- **Failed** #${f.pr}: ${f.reason}`);
    console.log(
      `::error::#${f.pr} could not be backported to ${target.branch}: ${f.reason}`,
    );
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const rows = [
      `### Security backports to \`${target.branch}\` (next: ${target.next})`,
      '',
      ...summaryRows,
      ...plan.skipped.map((s) => `- Skipped #${s.pr}: ${s.reason}`),
    ];
    writeFileSync(summary, `${rows.join('\n')}\n`, { flag: 'a' });
  }
  if (plan.failures.length > 0) process.exitCode = 1;
}

// release-notes.yml's autolabeler only runs on PRs to main, and the
// release/x.y draft only collects PRs labelled has-release-notes.
function label(repo, url, hasReleaseNotes) {
  const notes = 'has-release-notes';
  const labelled = tryRun('gh', [
    'pr',
    'edit',
    url,
    '--repo',
    repo,
    '--add-label',
    hasReleaseNotes ? `${LABEL},${notes}` : LABEL,
    ...(hasReleaseNotes ? [] : ['--remove-label', notes]),
  ]);
  if (!labelled.ok)
    console.log(`::warning::could not label ${url}: ${labelled.out}`);
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
