import { defineConfig, devices } from '@playwright/test';

/**
 * Coop end-to-end test configuration.
 *
 * The suite drives the real dashboard, so it expects the full stack
 * (Postgres/ClickHouse/Scylla/Redis + server + client) to be reachable at
 * `PLAYWRIGHT_BASE_URL`. See README.md for how to bring that up locally and in
 * CI. The suite runs on PRs and on pushes to main.
 *
 * https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // Fail the build on CI if test.only was left in the source.
  forbidOnly: !!process.env.CI,
  // Retry flaky moderator flows on CI; fail fast locally.
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallelism on CI for deterministic, low-noise runs.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],
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
