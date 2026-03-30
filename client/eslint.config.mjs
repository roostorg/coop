import { createRequire } from 'node:module';
import { FlatCompat } from '@eslint/eslintrc';
import { fixupConfigRules } from '@eslint/compat';

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
      '**/*.stories.tsx',
      'vite.config.ts',
      'vite-env.d.ts',
    ],
  },
  ...flatConfigs.map((config) =>
    config.files ? config : { ...config, files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'] },
  ),
];
