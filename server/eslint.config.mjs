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
      '**/*.d.ts',
      'eslint.config.mjs',
      '.eslintrc.cjs',
      '.eslintformat.js',
      'transpiled/**',
      'coverage/**',
      'lib/cache/**',
    ],
  },
  ...flatConfigs.map((config) =>
    config.files ? config : { ...config, files: ['**/*.ts', '**/*.tsx', '**/*.js'] },
  ),
];
