import { ScalarTypes, type Field } from '@roostorg/coop-types';
import { uid } from 'uid';

import { expect, jsonStringify, test } from '../fixtures/coop.js';

test('a rule routes a submitted item into a manual review queue', async ({
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
  const queue = await seed.createMrtQueue(admin);
  const actions = await deps.ModerationConfigService.getActions({
    orgId: admin.orgId,
  });
  const enqueueToMrt = actions.find((a) => a.actionType === 'ENQUEUE_TO_MRT');
  if (enqueueToMrt == null) {
    throw new Error('ENQUEUE_TO_MRT built-in action not found for org');
  }
  await seed.createRule(admin, itemType.id, {
    actionIds: [enqueueToMrt.id],
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

  const uniqueText = `test-${uid()}`;
  await seed.submitContentItem(request, admin, itemType.id, {
    text: uniqueText,
  });
  await seed.waitForQueueDrained();

  await seed.login(page, admin);
  await page.goto(`/dashboard/manual_review/queues/jobs/${queue.id}`);
  await expect(page.getByText(`Jobs in ${queue.name}`)).toBeVisible();
  await expect(page.getByText(uniqueText)).toBeVisible();
});
