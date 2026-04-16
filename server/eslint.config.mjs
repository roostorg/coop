import { createRequire } from 'node:module';
import { FlatCompat } from '@eslint/eslintrc';
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import functional from 'eslint-plugin-functional';

const require = createRequire(import.meta.url);
const { ignorePatterns: _, ...legacyConfig } = require('./.eslintrc.cjs');

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const functionalPlugin = fixupPluginRules(functional);

const flatConfigs = fixupConfigRules(compat.config(legacyConfig)).map((config) =>
  config.plugins?.functional
    ? {
        ...config,
        plugins: { ...config.plugins, functional: functionalPlugin },
      }
    : config,
);

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
