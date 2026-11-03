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
      await page
        .locator('.ant-select')
        .nth(2 + i * 2)
        .click();
      await page
        .locator(
          `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${fields[i].type}"]`,
        )
        .last()
        .click();
    }
  }

  await page.getByRole('button', { name: 'Create Content Type' }).click();
  await page.goto('/dashboard/settings/item_types');
  await expect(page.getByText(typeName)).toBeVisible();
});
