import { uid } from 'uid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import type { IActionExecutionsAdapter } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';

describe('ACTION_EXECUTIONS warehouse reads (integration)', () => {
  const orgId = uid();
  let deps: Dependencies | undefined;
  let adapter: IActionExecutionsAdapter;

  beforeAll(async () => {
    const bottle = await getBottle();
    deps = bottle.container;
    adapter = deps.ActionExecutionsAdapter;
  });

  afterAll(async () => {
    await deps?.closeSharedResourcesForShutdown();
  });

  describe('getRecentModeratorActions', () => {
    const cursor = {
      ts: new Date('2026-08-05T12:00:00.000Z'),
      correlationId: 'manual-action-run:abc',
    };
    const after = new Date('2026-08-01T00:00:00.000Z');
    const before = new Date('2026-08-31T23:59:59.000Z');

    const permutations: ReadonlyArray<
      [
        string,
        Parameters<IActionExecutionsAdapter['getRecentModeratorActions']>[0],
      ]
    > = [
      ['no optional filters', { orgId, limit: 10 }],
      [
        'a nonempty policy filter',
        { orgId, limit: 10, policyIds: ['policy-1'] },
      ],
      [
        'a multi-value policy filter',
        { orgId, limit: 10, policyIds: ['policy-1', 'policy-2'] },
      ],
      ['an actor filter', { orgId, limit: 10, actorIds: ['actor-1'] }],
      ['an item filter', { orgId, limit: 10, itemId: 'item-1' }],
      ['a cursor', { orgId, limit: 10, cursor }],
      ['a date range', { orgId, limit: 10, after, before }],
      [
        'a cursor inside a date range',
        { orgId, limit: 10, cursor, after, before },
      ],
      [
        'every filter at once',
        {
          orgId,
          limit: 10,
          cursor,
          after,
          before,
          actorIds: ['actor-1'],
          policyIds: ['policy-1'],
          itemId: 'item-1',
        },
      ],
    ];

    it.each(permutations)('executes with %s', async (_name, input) => {
      await expect(adapter.getRecentModeratorActions(input)).resolves.toEqual(
        [],
      );
    });
  });

  describe('getManualActionItems', () => {
    const base = {
      orgId,
      correlationId: 'manual-action-run:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
    };

    it('executes on the first page', async () => {
      await expect(
        adapter.getManualActionItems({ ...base, limit: 10, offset: 0 }),
      ).resolves.toEqual({ items: [], totalCount: 0 });
    });

    it('executes on a later page', async () => {
      await expect(
        adapter.getManualActionItems({ ...base, limit: 10, offset: 400 }),
      ).resolves.toEqual({ items: [], totalCount: 0 });
    });

    it('executes when the limit exceeds the server cap', async () => {
      await expect(
        adapter.getManualActionItems({ ...base, limit: 100_000, offset: 0 }),
      ).resolves.toEqual({ items: [], totalCount: 0 });
    });
  });

  describe('getManualActionItems paging over a real run', () => {
    const correlationId = `manual-action-run:${uid()}`;
    const occurredAt = new Date();
    const itemCount = 5;

    beforeAll(async () => {
      const ds = occurredAt.toISOString().slice(0, 10);
      await deps!.DataWarehouseAnalytics.bulkWrite(
        'ACTION_EXECUTIONS',
        Array.from({ length: itemCount }, (_unused, index) => ({
          ds,
          ts: occurredAt.valueOf(),
          org_id: orgId,
          action_id: 'action-1',
          action_name: 'Delete',
          action_source: 'manual-action-run',
          correlation_id: correlationId,
          item_id: `paged-item-${index}`,
          item_type_id: 'type-1',
          item_type_kind: 'CONTENT',
          policies: [],
          parameters: '{}',
          failed: false,
        })),
        { batchTimeout: 0 },
      );
    });

    it('reports the run total on the first page', async () => {
      const result = await adapter.getManualActionItems({
        orgId,
        correlationId,
        occurredAt,
        limit: 2,
        offset: 0,
      });

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(itemCount);
    });

    it('reports the run total on the last page', async () => {
      const result = await adapter.getManualActionItems({
        orgId,
        correlationId,
        occurredAt,
        limit: 2,
        offset: 4,
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(itemCount);
    });

    it('still reports the run total when the offset is past the end', async () => {
      const result = await adapter.getManualActionItems({
        orgId,
        correlationId,
        occurredAt,
        limit: 2,
        offset: 50,
      });

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(itemCount);
    });
  });

  describe('getItemActionHistory', () => {
    it('executes for an item with no history', async () => {
      await expect(
        adapter.getItemActionHistory({
          orgId,
          itemId: 'item-1',
          itemTypeId: 'type-1',
        }),
      ).resolves.toEqual([]);
    });
  });
});
