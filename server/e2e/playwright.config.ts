import { defineConfig, devices } from '@playwright/test';

/**
 * Coop end-to-end test configuration.
 *
 * Tests live in `server/` so they can self-seed using the server's DI container
 * and `test/fixtureHelpers` factories (see `fixtures/coop.ts`). They drive the
 * real dashboard, so they expect the full stack (Postgres/ClickHouse/Scylla/
 * Redis + server + client) to be reachable at `PLAYWRIGHT_BASE_URL`. See
 * README.md. The suite runs on PRs and on pushes to main.
 *
 * https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // Configured paths resolve relative to this config file's dir (server/e2e/),
  // so these land at server/e2e/{test-results,playwright-report} — matching the
  // CI upload path and the e2e/.gitignore.
  outputDir: 'test-results',
  // Fail the build on CI if test.only was left in the source.
  forbidOnly: Boolean(process.env.CI),
  // Retry flaky moderator flows on CI; fail fast locally.
  retries: process.env.CI ? 2 : 0,
  // Each test seeds committed DB state, so run serially on CI for determinism.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
      ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
