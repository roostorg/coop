import { ScalarTypes, type Field } from '@roostorg/coop-types';

import { expect, test } from '../fixtures/coop.js';

// A simple content item type with a single STRING field. Matches the shape
// used across the server-side integ tests (e.g. items-submission.integ.test.ts).
const STRING_FIELD: Field = {
  name: 'text',
  type: ScalarTypes.STRING,
  required: true,
  container: null,
};

test('a submitted item can be found in the investigation tool', async ({
  page,
  request,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  const itemType = await seed.createItemType(admin, [STRING_FIELD]);
  const { itemId } = await seed.submitContentItem(request, admin, itemType.id, {
    text: 'hello from e2e',
  });

  // Log in as the admin.
  await page.goto('/login');
  await page.locator('input[type="text"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Open the investigation tool. The ingest endpoint is async (202 -> queued),
  // so the item may not be queryable the instant we search. The investigation
  // query itself is a one-shot lazy fetch (no auto-retry), and a not-yet-indexed
  // item renders a stable "Item Not Found" error. So we re-trigger the search
  // until the item's type name appears, with a generous timeout to outlast the
  // queue drain. ponytail: a poll-on-not-found loop is the smallest fix that
  // doesn't couple the test to the queue's internals.
  await page.goto('/dashboard/manual_review/investigation');
  const idInput = page.getByPlaceholder('Enter an item ID');
  const searchButton = page.getByRole('button', { name: 'Search' });
  const typeName = page.getByText(itemType.name, { exact: true });

  await expect
    .poll(
      async () => {
        await idInput.fill(itemId);
        await searchButton.click();
        return (await typeName.isVisible()) ? 'found' : 'not-found';
      },
      {
        message: 'item is findable in the investigation tool',
        timeout: 30_000,
      },
    )
    .toBe('found');

  await expect(typeName).toBeVisible();
});
