import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    // Match native Node ESM imports of CommonJS dependencies.
    deps: { interopDefault: false },
    sequence: { hooks: 'list' },
    hookTimeout: 5_000,
    setupFiles: ['./test/extendExpect.ts'],
    include: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
    exclude: [
      'node_modules/**',
      'transpiled/**',
      'e2e/**',
      '**/*.integ.test.ts',
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      exclude: ['node_modules/**', 'test/**'],
      reporter: ['json', 'text', 'lcov', 'clover'],
    },
  },
});
