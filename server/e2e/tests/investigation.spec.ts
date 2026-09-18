import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, test } from '../fixtures/coop.js';

test('a submitted item can be found in the investigation tool', async ({
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
  const { itemId } = await seed.submitContentItem(request, admin, itemType.id, {
    text: 'hello from e2e',
  });
  await seed.waitForQueueDrained();

  await seed.login(page, admin);
  await page.goto('/dashboard/manual_review/investigation');
  await page.getByPlaceholder('Enter an item ID').fill(itemId);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(itemType.name).first()).toBeVisible();
});
