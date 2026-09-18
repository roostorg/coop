import { expect, test } from '../fixtures/coop.js';

test('a user can log in and their session persists until logout', async ({
  page,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();

  await page.goto('/login');
  await page.locator('input[type="text"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/dashboard/overview');
  await expect(page).toHaveURL(/\/dashboard\/overview/);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/overview/);

  const res = await page.request.post('/api/v1/graphql', {
    data: { query: 'mutation { logout }' },
  });
  expect(res.ok()).toBeTruthy();

  await page.goto('/dashboard/overview');
  await expect(page).toHaveURL(/\/login/);
});
