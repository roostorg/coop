import { uid } from 'uid';

import { expect, test } from '../fixtures/coop.js';

test('an admin creates an item type with mixed field types via the UI', async ({
  page,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  await seed.login(page, admin);

  await page.goto('/dashboard/settings/item_types/form?kind=CONTENT');
  await expect(page.getByText('Create Item Type')).toBeVisible();

  const typeName = `e2e-type-${uid()}`;
  await page.locator('input[placeholder="Name"]').fill(typeName);

  const fields = [
    { name: 'text', type: 'String' },
    { name: 'image', type: 'Image' },
    { name: 'audio', type: 'Audio' },
  ];
  for (let i = 0; i < fields.length; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: 'Add Field' }).click();
    }
    await page
      .locator('input[placeholder="Field Name"]')
      .nth(i)
      .fill(fields[i].name);
    if (fields[i].type !== 'String') {
      await page.getByRole('button', { name: 'Field Type' }).nth(i).click();
      await page
        .getByRole('option', { name: fields[i].type, exact: true })
        .click();
    }
  }

  await page.getByRole('button', { name: 'Create Content Type' }).click();
  await page.goto('/dashboard/settings/item_types');
  await expect(page.getByText(typeName)).toBeVisible();
});
