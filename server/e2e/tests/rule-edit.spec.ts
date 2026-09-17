import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, test } from '../fixtures/coop.js';

test('editing an existing live rule keeps its item types, actions, and status', async ({
  page,
  deps,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  const itemType = await deps.ModerationConfigService.createContentType(
    admin.orgId,
    {
      name: `e2e-type-${uid()}`,
      schema: [
        {
          name: 'text',
          type: ScalarTypes.STRING,
          required: true,
          container: null,
        },
      ] as [Field, ...Field[]],
      schemaFieldRoles: {},
    },
  );

  await seed.login(page, admin);
  await page.goto('/dashboard/rules/proactive/form');

  const ruleName = `e2e-rule-${uid()}`;
  await page.locator('input').first().fill(ruleName);
  await page.getByRole('button', { name: 'Select item types' }).click();
  await page.getByRole('option', { name: itemType.name, exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Select input' }).click();
  await page.getByRole('option', { name: 'text', exact: true }).click();
  await page.getByRole('button', { name: 'Select Signal' }).click();
  await page.getByPlaceholder('Search', { exact: true }).fill('Contains text');
  await page.getByText('Contains text', { exact: true }).click();
  await page.getByPlaceholder('Input Strings').fill('test');
  await page.getByPlaceholder('Input Strings').press('Enter');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Select actions' }).click();
  await page
    .getByRole('option', {
      name: 'Enqueue Item to Manual Review',
      exact: true,
    })
    .click();
  await page.getByText('Live', { exact: true }).click();
  await page.getByRole('button', { name: 'Create Rule' }).click();

  await expect(page.getByText('Rule Created').last()).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/dashboard\/rules\/proactive/);

  // Now open the rule for editing and confirm state populated correctly.
  await page.getByText(ruleName).click();
  await page.getByRole('button', { name: 'Edit Rule' }).click();
  await expect(
    page.getByRole('button', { name: /Select item types/ }),
  ).toHaveCount(0);
  await expect(page.getByText(itemType.name).first()).toBeVisible();
  await expect(
    page.getByText('Enqueue Item to Manual Review').first(),
  ).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  const saveButton = page.getByRole('button', { name: 'Save Changes' });
  await expect(saveButton).toBeEnabled();
});
