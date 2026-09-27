import { defineConfig } from 'vitest/config';

import config from './vitest.config.js';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['**/__tests__/**/*.[jt]s?(x)', '**/*.integ.test.ts'],
    exclude: ['node_modules/**', 'transpiled/**', 'e2e/**'],
  },
});
