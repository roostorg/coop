import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    isolate: false,
    // prevent parallel running of tests, as our tests don't currently support
    // parallel runs due to deadlocks:
    fileParallelism: false,
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
      provider: 'v8',
      reportsDirectory: 'reports/coverage-unit',
      include: ['**/*.ts'],
      exclude: [
        'node_modules/**',
        'transpiled/**',
        'reports/**',
        'bin/**',
        'e2e/**',
        'test/**',
        '**/*.{test,spec}.ts',
        '**/*.d.ts',
        '*.config.ts',
        'graphql/generated.ts',
      ],
      // Repo-relative lcov paths, so Codecov needs no path mapping.
      reporter: [
        'json',
        'text',
        ['lcov', { projectRoot: '..' }],
        'json-summary',
      ],
    },
    silent: 'passed-only',
  },
});
