import { expect, test } from '../fixtures/coop.js';

test('a user can log in', async ({ page, seed }) => {
  const admin = await seed.orgWithAdmin();

  await page.goto('/login');
  await page.locator('input[type="text"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
