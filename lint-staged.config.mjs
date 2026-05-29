import fs from 'node:fs';
import path from 'node:path';

// ESLint is configured per-package (client/.eslintrc, server/.eslintrc) and
// each package keeps its own plugins in its own node_modules. So we must
// invoke each package's eslint with paths relative to that package, not from
// the repo root.
const eslintInPackage = (pkg) => (files) => {
  const pkgRoot = path.resolve(pkg);
  const eslintBin = path.join(pkgRoot, 'node_modules', '.bin', 'eslint');
  if (!fs.existsSync(eslintBin)) {
    console.warn(
      `[lint-staged] skipping eslint in ${pkg}/: run "(cd ${pkg} && npm install)" to enable.`,
    );
    return [];
  }
  const rels = files
    .filter((f) => f.startsWith(pkgRoot + path.sep))
    .map((f) => path.relative(pkgRoot, f));
  if (rels.length === 0) return [];
  // Single-quote each path so it survives the outer double-quoted `bash -c`.
  // The previous JSON.stringify produced double-quoted args, which collapsed
  // against the outer `"..."` and left eslint with no file args — silently
  // making it lint the whole package directory instead.
  const args = rels.map((f) => `'${f.replace(/'/g, `'\\''`)}'`).join(' ');
  return `bash -c "cd ${pkg} && ./node_modules/.bin/eslint --fix ${args}"`;
};

export default {
  '*.{ts,tsx,js,jsx,mjs,cjs,json,md,yaml,yml}': 'prettier --write',
  'client/**/*.{ts,tsx,js,jsx}': eslintInPackage('client'),
  'server/**/*.{ts,tsx,js}': eslintInPackage('server'),
};
