import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { getBottleContainerWithIOMocks } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { type ItemSchema } from './index.js';

// Use real pooled connections, not the single-connection rollback harness:
// otherwise queries that accidentally bypass trx would still join the test transaction.
const testWithOrg = makeTestWithFixture(async () => {
  const deps = await getBottleContainerWithIOMocks();
  const fixture = await createOrg(deps);
  return {
    deps,
    orgId: fixture.org.id,
    async cleanup() {
      try {
        await fixture.cleanup();
      } finally {
        await deps.closeSharedResourcesForShutdown();
      }
    },
  };
});

const schema: ItemSchema = [
  { name: 'title', type: 'STRING', required: true, container: null },
];

describe.each([
  ['CONTENT', 'createContentType', 'updateContentType'],
  ['THREAD', 'createThreadType', 'updateThreadType'],
  ['USER', 'createUserType', 'updateUserType'],
] as const)('%s item-type transactions', (kind, create, update) => {
  testWithOrg(
    'commits both services and refreshes the shared cache',
    async ({ deps, orgId }) => {
      const config = deps.ModerationConfigService;
      const review = deps.ManualReviewToolService;
      await config.getItemTypes({ orgId });

      const created = await config.withItemTypeTransaction(
        orgId,
        async (trx) => {
          const item = await config[create](
            orgId,
            {
              name: 'Transactional type',
              schema,
              schemaFieldRoles: {},
            },
            trx,
          );
          await review.setHiddenFieldsForItemType(
            {
              orgId,
              itemTypeId: item.id,
              hiddenFields: ['title'],
            },
            trx,
          );
          expect(
            await review.getHiddenFieldsForItemType(
              { orgId, itemTypeId: item.id },
              trx,
            ),
          ).toEqual(['title']);
          // A separate connection and the shared cache must not see uncommitted data.
          expect(
            await review.getHiddenFieldsForItemType({
              orgId,
              itemTypeId: item.id,
            }),
          ).toEqual([]);
          expect(await config.getItemTypes({ orgId })).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: item.id })]),
          );
          return item;
        },
      );

      expect(created).toMatchObject({
        name: 'Transactional type',
        kind,
        schema,
      });
      expect(await config.getItemTypes({ orgId })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: created.id, name: created.name }),
        ]),
      );
      expect(
        await review.getHiddenFieldsForItemType({
          orgId,
          itemTypeId: created.id,
        }),
      ).toEqual(['title']);
    },
  );

  testWithOrg(
    'rolls back both services without caching the aborted update',
    async ({ deps, orgId }) => {
      const config = deps.ModerationConfigService;
      const review = deps.ManualReviewToolService;
      const original = await config[create](orgId, {
        name: 'Original',
        schema,
        schemaFieldRoles: {},
      });
      // Populate the cache before the write locks the item-type materialized view.
      await config.getItemTypes({ orgId });
      const failure = new Error('Abort combined update');

      await expect(
        config.withItemTypeTransaction(orgId, async (trx) => {
          const updated = await config[update](
            orgId,
            {
              id: original.id,
              name: 'Uncommitted',
              schemaFieldRoles: { displayName: 'title' },
            },
            trx,
          );
          expect(updated).toMatchObject({
            name: 'Uncommitted',
            schemaFieldRoles: { displayName: 'title' },
          });
          await review.setHiddenFieldsForItemType(
            { orgId, itemTypeId: original.id, hiddenFields: ['title'] },
            trx,
          );
          expect(
            await review.getHiddenFieldsForItemType(
              { orgId, itemTypeId: original.id },
              trx,
            ),
          ).toEqual(['title']);
          expect(await config.getItemTypes({ orgId })).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: original.id, name: 'Original' }),
            ]),
          );
          throw failure;
        }),
      ).rejects.toBe(failure);

      expect(await config.getItemTypes({ orgId })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: original.id, name: 'Original' }),
        ]),
      );
      expect(
        await deps.KyselyPg.selectFrom('public.item_types')
          .select(['name', 'display_name_field'])
          .where('id', '=', original.id)
          .executeTakeFirstOrThrow(),
      ).toEqual({ name: 'Original', display_name_field: null });
      expect(
        await review.getHiddenFieldsForItemType({
          orgId,
          itemTypeId: original.id,
        }),
      ).toEqual([]);
    },
  );
});

describe('standalone hidden-field writes', () => {
  testWithOrg(
    'validates item ownership and schema while allowing post-delete cleanup',
    async ({ deps, orgId }) => {
      const item = await deps.ModerationConfigService.createContentType(orgId, {
        name: 'Hidden field validation',
        schema,
        schemaFieldRoles: {},
      });

      await expect(
        deps.ManualReviewToolService.setHiddenFieldsForItemType({
          orgId,
          itemTypeId: item.id,
          hiddenFields: ['missing'],
        }),
      ).rejects.toMatchObject({ name: 'InvalidItemTypeHiddenFieldsError' });
      await expect(
        deps.ManualReviewToolService.setHiddenFieldsForItemType({
          orgId: 'another-org',
          itemTypeId: item.id,
          hiddenFields: ['title'],
        }),
      ).rejects.toMatchObject({ name: 'NotFoundError' });

      await deps.ManualReviewToolService.setHiddenFieldsForItemType({
        orgId,
        itemTypeId: item.id,
        hiddenFields: ['title'],
      });
      await deps.ModerationConfigService.deleteItemType({
        orgId,
        itemTypeId: item.id,
      });
      await expect(
        deps.ManualReviewToolService.setHiddenFieldsForItemType({
          orgId,
          itemTypeId: item.id,
          hiddenFields: [],
        }),
      ).resolves.toBeDefined();
      await expect(
        deps.ManualReviewToolService.getHiddenFieldsForItemType({
          orgId,
          itemTypeId: item.id,
        }),
      ).resolves.toEqual([]);
    },
  );
});
