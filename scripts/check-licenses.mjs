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

// Evaluates an SPDX expression: OR passes if any side passes, AND needs both,
// and AND binds tighter than OR unless parentheses say otherwise. A
// `<license> WITH <exception>` term must be allowed as written.
const isAllowed = (expr) => {
  const tokens = expr.match(/\(|\)|[^\s()]+/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const parseOr = () => {
    let ok = parseAnd();
    while (peek() === 'OR') {
      next();
      ok = parseAnd() || ok;
    }
    return ok;
  };
  const parseAnd = () => {
    let ok = parseTerm();
    while (peek() === 'AND') {
      next();
      ok = parseTerm() && ok;
    }
    return ok;
  };
  const parseTerm = () => {
    const token = next();
    if (token === '(') {
      const ok = parseOr();
      if (next() !== ')') throw new Error(`unbalanced parentheses: ${expr}`);
      return ok;
    }
    if (
      token === undefined ||
      token === ')' ||
      token === 'AND' ||
      token === 'OR'
    )
      throw new Error(`malformed license expression: ${expr}`);
    if (peek() === 'WITH') {
      next();
      return allowed.has(`${token} WITH ${next()}`);
    }
    return allowed.has(token);
  };
  try {
    const ok = parseOr();
    return pos === tokens.length && ok;
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
