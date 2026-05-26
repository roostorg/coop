import { createRequire } from 'node:module';
import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';

const require = createRequire(import.meta.url);
const { ignorePatterns: _, ...legacyConfig } = require('./.eslintrc.cjs');

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const flatConfigs = fixupConfigRules(compat.config(legacyConfig));

export default [
  {
    ignores: [
      '.eslintrc.cjs',
      'eslint.config.mjs',
      'eslint/**',
      'tailwind.config.js',
      'postcss.config.js',
      '.storybook/**',
      '**/*.stories.tsx',
      'vite.config.ts',
      'vite-env.d.ts',
      // Build output (gitignored) and tooling config not in tsconfig.
      'build/**',
      '.storybook/**',
      'postcss.config.js',
    ],
  },
  ...flatConfigs.map((config) =>
    config.files
      ? config
      : { ...config, files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'] },
  ),
];
