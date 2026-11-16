// Fails if HEAD's pnpm-lock.yaml resolves any package to a version newer than
// the base ref's lockfile has for it. On a backport branch, such a version
// means pnpm re-resolved a range instead of taking the versions already tested
// on the base.
//
// Usage: node scripts/check-lockfile-backport.mjs [base-ref] [--include-new]
//
//   base-ref       git ref to compare against (default: origin/main)
//   --include-new  also fail on packages missing from the base entirely, and
//                  on older version lines (major, or minor for 0.x) of a
//                  package that the base doesn't have
//
// A version counts as newer when it is above every base version of the
// package in the same version line, or, if the base has none in that line,
// above every base version of the package. Older versions within a line the
// base has are expected on a backport branch and aren't reported.
//
// Exits 0 when nothing is reported, 1 when something is, 2 on usage or input
// errors. Reads both lockfiles with `git show`, so HEAD means the committed
// lockfile, not the working tree.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SUPPORTED_LOCKFILE_MAJOR = '9';

// Returns Map<packageName, Set<version>> from the `packages:` section of a
// pnpm v9 lockfile. Each package version is a top-level key in that section,
// e.g. `  '@babel/core@7.26.0':` or `  yaml@2.9.1:`; peer-dependency variants
// only appear under `snapshots:`, so each version is listed once.
export function parseLockfile(text) {
  const versionMatch = text.match(/^lockfileVersion: '?([^'\n]+)'?$/m);
  if (!versionMatch) {
    throw new Error('no lockfileVersion found');
  }
  const major = versionMatch[1].split('.')[0];
  if (major !== SUPPORTED_LOCKFILE_MAJOR) {
    throw new Error(
      `lockfileVersion ${versionMatch[1]} is not supported (expected ${SUPPORTED_LOCKFILE_MAJOR}.x)`,
    );
  }

  const packages = new Map();
  let inPackages = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) {
      inPackages = line === 'packages:';
      continue;
    }
    if (!inPackages) continue;
    const keyMatch = line.match(/^ {2}(?! )'?(.+?)'?:$/);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    const at = key.indexOf('@', 1);
    if (at === -1) continue;
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    if (!packages.has(name)) packages.set(name, new Set());
    packages.get(name).add(version);
  }
  return packages;
}

const SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseSemver(version) {
  const m = version.match(SEMVER);
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

function compareIdentifiers(a, b) {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  if (aNum) return -1;
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return b.prerelease.length - a.prerelease.length;
  }
  const len = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < len; i++) {
    if (a.prerelease[i] === undefined) return -1;
    if (b.prerelease[i] === undefined) return 1;
    const c = compareIdentifiers(a.prerelease[i], b.prerelease[i]);
    if (c !== 0) return c;
  }
  return 0;
}

// The versions a caret range would float between: same major, or same minor
// for 0.x.
function versionLine({ core: [major, minor] }) {
  return major === 0 ? `0.${minor}` : `${major}`;
}

// Compares each version HEAD resolves against the base's versions of the same
// package in the same version line, so a package resolved at several majors
// is checked line by line.
export function compareLockfiles(base, head) {
  const newer = [];
  const added = [];
  for (const [name, headVersions] of head) {
    const baseVersions = base.get(name) ?? new Set();
    for (const version of headVersions) {
      if (baseVersions.has(version)) continue;
      const parsed = parseSemver(version);
      if (!parsed) {
        added.push({ name, version, base: [...baseVersions] });
        continue;
      }
      const baseParsed = [...baseVersions]
        .map((v) => ({ v, parsed: parseSemver(v) }))
        .filter((b) => b.parsed);
      const sameLine = baseParsed.filter(
        (b) => versionLine(b.parsed) === versionLine(parsed),
      );
      // Within a line the base already has, an older version is what a
      // backport is expected to have; only a newer one is drift. Without
      // such a line, compare against every base version.
      const candidates = sameLine.length > 0 ? sameLine : baseParsed;
      const isNewer =
        candidates.length > 0 &&
        candidates.every((b) => compareSemver(parsed, b.parsed) > 0);
      if (isNewer) {
        newer.push({ name, version, base: candidates.map((b) => b.v) });
      } else if (sameLine.length === 0) {
        added.push({ name, version, base: [...baseVersions] });
      }
    }
  }
  const byId = (a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`);
  return { newer: newer.sort(byId), added: added.sort(byId) };
}

function readLockfile(ref) {
  return execFileSync('git', ['show', `${ref}:pnpm-lock.yaml`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function main(argv) {
  const includeNew = argv.includes('--include-new');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const unknown = argv.filter(
    (a) => a.startsWith('--') && a !== '--include-new',
  );
  if (unknown.length > 0 || positional.length > 1) {
    console.error(
      'Usage: node scripts/check-lockfile-backport.mjs [base-ref] [--include-new]',
    );
    return 2;
  }
  const baseRef = positional[0] ?? 'origin/main';

  let base;
  let head;
  try {
    base = parseLockfile(readLockfile(baseRef));
    head = parseLockfile(readLockfile('HEAD'));
  } catch (err) {
    console.error(`Could not read lockfiles: ${err.message}`);
    return 2;
  }

  const { newer, added } = compareLockfiles(base, head);
  const format = ({ name, version, base: baseVersions }) =>
    `  ${name}@${version}` +
    (baseVersions.length > 0
      ? ` (${baseRef}: ${baseVersions.join(', ')})`
      : '');

  if (newer.length > 0) {
    console.log(`Newer than ${baseRef}:`);
    newer.forEach((e) => console.log(format(e)));
  }
  if (includeNew && added.length > 0) {
    console.log(`Not on ${baseRef}:`);
    added.forEach((e) => console.log(format(e)));
  }

  const found = newer.length + (includeNew ? added.length : 0);
  if (found === 0) {
    console.log(`No package in HEAD's lockfile is newer than on ${baseRef}.`);
    if (!includeNew && added.length > 0) {
      console.log(
        `${added.length} package version(s) in version lines not on ${baseRef}; pass --include-new to list them.`,
      );
    }
    return 0;
  }
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
