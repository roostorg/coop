import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, jsonStringify, test } from '../fixtures/coop.js';

test('an item shows its rule execution / signal results in the investigation tool', async ({
  page,
  request,
  deps,
  seed,
}) => {
  const admin = await seed.orgWithAdmin();
  const itemType = await deps.ModerationConfigService.createContentType(
    admin.orgId,
    {
      name: `type-${uid()}`,
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
  const rule = await seed.createRule(admin, itemType.id, {
    conditionSet: {
      conjunction: 'AND',
      conditions: [
        {
          input: {
            type: 'CONTENT_FIELD',
            name: 'text',
            contentTypeId: itemType.id,
          },
          signal: {
            id: jsonStringify({ type: 'TEXT_MATCHING_CONTAINS_TEXT' }),
            type: 'TEXT_MATCHING_CONTAINS_TEXT',
          },
          matchingValues: { strings: ['test'] },
        },
      ],
    },
  });
  const { itemId } = await seed.submitContentItem(request, admin, itemType.id, {
    text: 'this is a test',
  });
  await seed.waitForQueueDrained();

  await seed.login(page, admin);
  await page.goto('/dashboard/manual_review/investigation');
  await page.getByPlaceholder('Enter an item ID').fill(itemId);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(rule.name).first()).toBeVisible();
  await expect(
    page.getByText('Matched', { exact: true }).first(),
  ).toBeVisible();
});
