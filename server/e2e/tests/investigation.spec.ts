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
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  const itemType = await seed.createItemType(admin, [STRING_FIELD]);
  const { itemId } = await seed.submitContentItem(admin, itemType.id, {
    text: 'hello from e2e',
  });

  // Log in as the admin.
  await page.goto('/login');
  await page.locator('input[type="text"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Open the investigation tool and search for the submitted item.
  await page.goto('/dashboard/manual_review/investigation');
  await page.getByPlaceholder('Enter an item ID').fill(itemId);
  await page.getByRole('button', { name: 'Search' }).click();

  // The investigation summary renders the item type name as a header.
  // ponytail: asserting on the item type name is the smallest signal that the
  // item was ingested, indexed, and is queryable through the investigation UI.
  // Deeper field-rendering/decision assertions belong to the MRT flow test.
  await expect(page.getByText(itemType.name, { exact: true })).toBeVisible();
});
