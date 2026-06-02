// Fails if any production dependency of a workspace package has a license
// outside ALLOWED_LICENSES (semicolon-separated SPDX ids).
//
// Usage: pnpm licenses list --prod --json --filter ./server | node scripts/check-licenses.mjs
//
// Replaces license-checker, which only walks nested node_modules and so sees a
// fraction of the tree under pnpm's symlinked layout.

import { readFileSync } from 'node:fs';

// Packages whose package.json has no license field, checked by hand.
const MANUALLY_VERIFIED = {
  'pause@0.0.1': 'MIT (stated in Readme.md)',
};

const allowed = new Set(
  (process.env.ALLOWED_LICENSES ?? '').split(';').filter(Boolean),
);
if (allowed.size === 0) {
  console.error('ALLOWED_LICENSES is empty');
  process.exit(1);
}

const input = readFileSync(0, 'utf8').trim();
// pnpm prints a plain message instead of JSON when there are no dependencies.
const byLicense = input.startsWith('{') ? JSON.parse(input) : {};

// "(MIT OR CC0-1.0)" passes if any alternative passes; "MIT AND ISC" needs all.
const isAllowed = (expr) =>
  expr
    .replace(/[()]/g, '')
    .split(/\s+OR\s+/)
    .some((alt) =>
      alt.split(/\s+AND\s+/).every((id) => allowed.has(id.trim())),
    );

const failures = [];
let count = 0;
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const pkg of pkgs) {
    for (const version of pkg.versions) {
      count++;
      const id = `${pkg.name}@${version}`;
      if (!isAllowed(license) && !MANUALLY_VERIFIED[id]) {
        failures.push(`${id}: ${license}`);
      }
    }
  }
}

console.log(`Checked ${count} production packages.`);
if (failures.length > 0) {
  console.error(`Disallowed licenses:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
