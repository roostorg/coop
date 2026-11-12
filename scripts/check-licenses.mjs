// Fails if any production dependency of the workspace packages has a license
// outside ALLOWED_LICENSES (semicolon-separated SPDX ids).
//
// Usage: pnpm licenses list --prod --json -r | node scripts/check-licenses.mjs
//
// Replaces license-checker, which only walks nested node_modules and so sees a
// fraction of the tree under pnpm's symlinked layout.

import { readFileSync } from 'node:fs';
import satisfies from 'spdx-satisfies';

const allowed = (process.env.ALLOWED_LICENSES ?? '').split(';').filter(Boolean);
if (allowed.length === 0) {
  console.error('ALLOWED_LICENSES is empty');
  process.exit(1);
}

const byLicense = JSON.parse(readFileSync(0, 'utf8'));

// satisfies() throws on anything that isn't a valid SPDX expression, such as
// pnpm's "Unknown" for packages without a license field.
const isAllowed = (expr) => {
  try {
    return satisfies(expr, allowed);
  } catch {
    return false;
  }
};

const failures = [];
let count = 0;
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const pkg of pkgs) {
    for (const version of pkg.versions) {
      count++;
      const id = `${pkg.name}@${version}`;
      if (!isAllowed(license)) {
        failures.push(`${id}: ${license}`);
      }
    }
  }
}

console.log(`Checked ${count} production packages.`);
if (count === 0) {
  console.error(
    'No packages to check; is the input from `pnpm licenses list`?',
  );
  process.exit(1);
}
if (failures.length > 0) {
  console.error(`Disallowed licenses:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
