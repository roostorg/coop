import { defineConfig, devices } from '@playwright/test';

/**
 * https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // Configured paths resolve relative to this config file's dir (server/e2e/),
  // so these land at server/e2e/{test-results,playwright-report}.
  outputDir: 'test-results',
  // Run every test concurrently. This helps ensure that we do
  // not get implicit dependencies between tests.
  fullyParallel: true,
  // Fail the build on CI if test.only was left in the source.
  forbidOnly: Boolean(process.env.CI),
  // Retry flaky flows on CI; fail fast locally.
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
