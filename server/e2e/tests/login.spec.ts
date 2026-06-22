import { expect, test } from '../fixtures/coop.js';

/**
 * Login + session — the first of the moderator-critical flows from #485.
 *
 * The test seeds its own org + password-login admin via the DI factories, then
 * logs in through the real form (client/src/webpages/auth/Login.tsx): the email
 * field is the only `type=text` input, the password field is an Ant
 * `Input.Password` (`type=password`), and the submit is a `CoopButton`
 * rendering a real <button> labelled "Sign In". A successful login navigates to
 * /dashboard. (Both inputs expose the textbox role in this Ant version, so we
 * select by input type rather than role to stay unambiguous.)
 */
test('a moderator can log in', async ({ page, seed }) => {
  const admin = await seed.orgWithAdmin();

  await page.goto('/login');
  await page.locator('input[type="text"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
