import { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { getBottleContainerWithIOMocks } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import { makeKyselyTransactionWithRetry } from '../../utils/kyselyTransactionWithRetry.js';
import { ManualReviewToolService } from '../manualReviewToolService/index.js';
import { ModerationConfigService, type ItemSchema } from './index.js';

// Real pooled connections expose queries that accidentally escape the transaction.
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

// Only the connection changes; neither service needs transaction-specific methods.
function makeServices(db: Dependencies['KyselyPg'], deps: Dependencies) {
  const config = new ModerationConfigService(db, db, async () => {});
  const review = new ManualReviewToolService(
    deps.IORedis,
    deps.RuleEvaluator,
    deps.RoutingRuleExecutionLogger,
    db,
    db,
    deps.UserStatisticsService,
    deps.getActionsByIdEventuallyConsistent,
    deps.Tracer,
    config,
    deps.PartialItemsService,
    async () => {},
    async () => {},
    async () => false,
    deps.ManualReviewContentResolver,
  );
  return { config, review };
}

const schema: ItemSchema = [
  { name: 'title', type: 'STRING', required: true, container: null },
];

describe.each([
  ['CONTENT', 'createContentType', 'updateContentType'],
  ['THREAD', 'createThreadType', 'updateThreadType'],
  ['USER', 'createUserType', 'updateUserType'],
] as const)('%s constructor-injected transactions', (kind, create, update) => {
  testWithOrg(
    'commits both services and invalidates the original cache after commit',
    async ({ deps, orgId }) => {
      const original = deps.ModerationConfigService;
      const before = await original.getItemTypes({ orgId });
      const item = await makeKyselyTransactionWithRetry(deps.KyselyPg)(
        async (trx) => {
          const { config, review } = makeServices(trx, deps);
          const created = await config[create](orgId, {
            name: 'Created in transaction',
            schema,
            schemaFieldRoles: {},
          });
          await review.setHiddenFieldsForItemType({
            orgId,
            itemTypeId: created.id,
            hiddenFields: ['title'],
          });
          expect(
            await review.getHiddenFieldsForItemType({
              orgId,
              itemTypeId: created.id,
            }),
          ).toEqual(['title']);
          expect(
            await deps.ManualReviewToolService.getHiddenFieldsForItemType({
              orgId,
              itemTypeId: created.id,
            }),
          ).toEqual([]);
          expect(await original.getItemTypes({ orgId })).toEqual(before);
          return created;
        },
      );
      await original.invalidateLatestItemTypesCache(orgId);
      expect(item).toMatchObject({
        kind,
        schema,
        name: 'Created in transaction',
      });
      expect(await original.getItemTypes({ orgId })).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: item.id })]),
      );
      expect(
        await deps.ManualReviewToolService.getHiddenFieldsForItemType({
          orgId,
          itemTypeId: item.id,
        }),
      ).toEqual(['title']);
    },
  );

  testWithOrg(
    'rolls back both services without publishing transaction-local cached data',
    async ({ deps, orgId }) => {
      const original = deps.ModerationConfigService;
      const item = await original[create](orgId, {
        name: 'Original',
        schema,
        schemaFieldRoles: {},
      });
      const before = await original.getItemTypes({ orgId });
      const failure = new Error('Abort transaction');
      await expect(
        makeKyselyTransactionWithRetry(deps.KyselyPg)(async (trx) => {
          const { config, review } = makeServices(trx, deps);
          // Warm the transaction-local cache, then ensure a write refreshes it.
          await config.getItemTypes({ orgId });
          const updated = await config[update](orgId, {
            id: item.id,
            name: 'Uncommitted',
            schemaFieldRoles: { displayName: 'title' },
          });
          expect(updated).toMatchObject({
            name: 'Uncommitted',
            schemaFieldRoles: { displayName: 'title' },
          });
          await review.setHiddenFieldsForItemType({
            orgId,
            itemTypeId: item.id,
            hiddenFields: ['title'],
          });
          expect(await config.getItemTypes({ orgId })).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: item.id, name: 'Uncommitted' }),
            ]),
          );
          expect(await original.getItemTypes({ orgId })).toEqual(before);
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(await original.getItemTypes({ orgId })).toEqual(before);
      expect(
        await deps.KyselyPg.selectFrom('public.item_types')
          .select(['name', 'display_name_field'])
          .where('id', '=', item.id)
          .executeTakeFirstOrThrow(),
      ).toEqual({ name: 'Original', display_name_field: null });
      expect(
        await deps.ManualReviewToolService.getHiddenFieldsForItemType({
          orgId,
          itemTypeId: item.id,
        }),
      ).toEqual([]);
    },
  );
});

describe('injected transaction retry ownership', () => {
  testWithOrg(
    'joins the injected transaction and leaves retries to the outer owner',
    async ({ deps }) => {
      const outer = jest.fn();
      const inner = jest.fn();
      const result = await makeKyselyTransactionWithRetry(deps.KyselyPg)(
        async (trx) => {
          outer();
          return makeKyselyTransactionWithRetry(trx)(async (joined) => {
            inner();
            expect(joined).toBe(trx);
            if (outer.mock.calls.length === 1) {
              throw Object.assign(new Error('serialization failure'), {
                code: '40001',
              });
            }
            return 'committed';
          });
        },
      );
      expect(result).toBe('committed');
      expect(outer).toHaveBeenCalledTimes(2);
      expect(inner).toHaveBeenCalledTimes(2);
    },
  );

  testWithOrg(
    'rejects nested isolation options rather than silently ignoring them',
    async ({ deps }) => {
      const callback = jest.fn();
      await makeKyselyTransactionWithRetry(deps.KyselyPg)(async (trx) => {
        await expect(
          makeKyselyTransactionWithRetry(trx)(
            { isolationLevel: 'serializable' },
            callback,
          ),
        ).rejects.toThrow(
          'Isolation level must be set on the outer transaction',
        );
        expect(callback).not.toHaveBeenCalled();
      });
    },
  );
});
