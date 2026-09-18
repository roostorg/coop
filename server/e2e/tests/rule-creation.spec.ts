import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, test } from '../fixtures/coop.js';

test('an admin creates a content rule with a condition and an MRT action via the UI', async ({
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
  await expect(page.getByText('Create Rule').first()).toBeVisible();

  const ruleName = `e2e-rule-${uid()}`;
  await page.locator('input').first().fill(ruleName);
  await page.locator('.ant-select').first().click();
  await page
    .locator(
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${itemType.name}"]`,
    )
    .click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('.ant-select').nth(1).click();
  await page
    .locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    )
    .filter({ hasText: /^text$/ })
    .last()
    .click();
  await page.getByRole('button', { name: 'Select Signal' }).click();
  await page.getByPlaceholder('Search').fill('Contains text');
  await page.getByText('Contains text', { exact: true }).click();
  await page.getByPlaceholder('Input Strings').fill('test');
  await page.getByPlaceholder('Input Strings').press('Enter');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('.ant-select').nth(2).click();
  await page
    .locator(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    )
    .filter({ hasText: 'Enqueue Item to Manual Review' })
    .last()
    .click();
  await page.getByText('Live', { exact: true }).click();
  await page.getByRole('button', { name: 'Create Rule' }).click();

  await expect(page.getByText('Rule Created')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/dashboard\/rules\/proactive/);
  await expect(page.getByText(ruleName)).toBeVisible();
});
