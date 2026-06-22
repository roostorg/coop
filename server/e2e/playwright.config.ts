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
  // Run every test concurrently (Playwright has no random-order flag; this is
  // the idiomatic equivalent). Combined with per-test unique-org isolation, no
  // test can depend on another's state or on execution order. Default worker
  // count scales to the runner's CPUs.
  fullyParallel: true,
  // Fail the build on CI if test.only was left in the source.
  forbidOnly: Boolean(process.env.CI),
  // Retry flaky moderator flows on CI; fail fast locally.
  retries: process.env.CI ? 2 : 0,
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
