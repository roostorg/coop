import { expect, test } from '@playwright/test';

/**
 * Login + session — the first of the moderator-critical flows from #485.
 *
 * Selectors target the real login form (client/src/webpages/auth/Login.tsx):
 * the email field is the only `type=text` input, the password field is an Ant
 * `Input.Password` (`type=password`), and the submit is a `CoopButton`
 * rendering a real <button> labelled "Sign In". A successful login navigates to
 * /dashboard. (Both inputs expose the textbox role in this Ant version, so we
 * select by input type rather than role to stay unambiguous.)
 *
 * Credentials come from the env (seeded by the create-org step locally and in
 * CI); the defaults match the documented local setup.
 */
const EMAIL = process.env.E2E_EMAIL ?? 'e2e@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password';

test('a moderator can log in', async ({ page }) => {
  await page.goto('/login');

  await page.locator('input[type="text"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
