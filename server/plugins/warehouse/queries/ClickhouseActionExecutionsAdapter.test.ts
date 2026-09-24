import { ProxyTracerProvider } from '@opentelemetry/api';

import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import SafeTracer from '../../../utils/SafeTracer.js';
import { ClickhouseActionExecutionsAdapter } from './ClickhouseActionExecutionsAdapter.js';

function makeWarehouse(rows: ReadonlyArray<Record<string, unknown>>) {
  const query = jest.fn(
    async (
      _q: string,
      _t: SafeTracer,
      _b?: readonly unknown[],
    ): Promise<unknown[]> => [...rows],
  );
  const warehouse: IDataWarehouse = {
    query,
    transaction: jest.fn(),
    start: jest.fn(),
    close: jest.fn(),
    getProvider: jest.fn(),
  };
  return { warehouse, query };
}

function makeAdapter(rows: ReadonlyArray<Record<string, unknown>>) {
  const { warehouse, query } = makeWarehouse(rows);
  const tracer = new SafeTracer(new ProxyTracerProvider().getTracer('noop'));
  return {
    adapter: new ClickhouseActionExecutionsAdapter(warehouse, tracer),
    query,
  };
}

describe('ClickhouseActionExecutionsAdapter.findInferredUserIdentity', () => {
  it('returns null when no rows match', async () => {
    const { adapter } = makeAdapter([]);

    const result = await adapter.findInferredUserIdentity({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result).toBeNull();
  });

  it('projects item_type_id when the row matches via direct user-kind action', async () => {
    const ts = '2026-05-01T00:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'i-1',
        item_type_id: 'user-type-A',
        item_type_kind: 'USER',
        item_creator_id: null,
        item_creator_type_id: null,
      },
    ]);

    const result = await adapter.findInferredUserIdentity({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result).toEqual({
      itemTypeId: 'user-type-A',
      lastSeenAt: new Date(ts),
    });
  });

  it('projects item_creator_type_id when the row matches via creator reference', async () => {
    const ts = '2026-05-02T00:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'content-99',
        item_type_id: 'content-type-X',
        item_type_kind: 'CONTENT',
        item_creator_id: 'i-1',
        item_creator_type_id: 'user-type-B',
      },
    ]);

    const result = await adapter.findInferredUserIdentity({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result?.itemTypeId).toBe('user-type-B');
  });

  it('matches case-insensitively on the projected id', async () => {
    const ts = '2026-05-02T00:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'I-1',
        item_type_id: 'user-type-A',
        item_type_kind: 'USER',
        item_creator_id: null,
        item_creator_type_id: null,
      },
    ]);

    const result = await adapter.findInferredUserIdentity({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result?.itemTypeId).toBe('user-type-A');
  });

  it('filters out null/empty creator_type_id rows in SQL and uses LIMIT 1', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.findInferredUserIdentity({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('item_type_id IS NOT NULL');
    expect(sentSql).toContain("item_type_id != ''");
    expect(sentSql).toContain('item_creator_type_id IS NOT NULL');
    expect(sentSql).toContain("item_creator_type_id != ''");
    expect(sentSql).toContain('LIMIT 1');
  });

  it('passes the org id and a lookback ds bound to the underlying query', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.findInferredUserIdentity({
      orgId: 'org-99',
      itemId: 'i-1',
      lookbackWindowMs: 24 * 60 * 60 * 1000,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('analytics.ACTION_EXECUTIONS');
    expect(sentSql).toContain('org_id');
    expect(sentSql).toContain('org-99');
  });
});

describe('ClickhouseActionExecutionsAdapter.getRecentUserStrikeActions', () => {
  it('includes creator fields in the returned records', async () => {
    const ts = '2026-06-01T10:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'content-1',
        item_type_id: 'content-type-A',
        item_type_kind: 'CONTENT',
        item_creator_id: 'user-7',
        item_creator_type_id: 'user-type-X',
        action_id: 'action-ban',
        action_source: 'user-strike-action-execution',
      },
    ]);

    const results = await adapter.getRecentUserStrikeActions({
      orgId: 'org-1',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      actionId: 'action-ban',
      itemId: 'content-1',
      itemTypeId: 'content-type-A',
      creatorId: 'user-7',
      creatorTypeId: 'user-type-X',
      source: 'user-strike-action-execution',
    });
  });

  it('returns null creator fields when columns are null', async () => {
    const ts = '2026-06-01T10:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'user-direct',
        item_type_id: 'user-type-A',
        item_type_kind: 'USER',
        item_creator_id: null,
        item_creator_type_id: null,
        action_id: 'action-suspend',
        action_source: 'user-strike-action-execution',
      },
    ]);

    const results = await adapter.getRecentUserStrikeActions({
      orgId: 'org-1',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.creatorId).toBeNull();
    expect(results[0]?.creatorTypeId).toBeNull();
  });

  it('returns both creator fields when both are present in the row', async () => {
    const ts = '2026-06-01T10:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'content-1',
        item_type_id: 'content-type-A',
        item_type_kind: 'CONTENT',
        item_creator_id: 'user-5',
        item_creator_type_id: null,
        action_id: 'action-ban',
        action_source: 'user-strike-action-execution',
      },
    ]);

    const results = await adapter.getRecentUserStrikeActions({
      orgId: 'org-1',
      limit: 10,
    });

    expect(results[0]?.creatorId).toBe('user-5');
    expect(results[0]?.creatorTypeId).toBeNull();
  });

  it('normalizes empty-string creator fields to null', async () => {
    const ts = '2026-06-01T10:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_id: 'content-1',
        item_type_id: 'content-type-A',
        item_type_kind: 'CONTENT',
        item_creator_id: '',
        item_creator_type_id: '',
        action_id: 'action-ban',
        action_source: 'user-strike-action-execution',
      },
    ]);

    const results = await adapter.getRecentUserStrikeActions({
      orgId: 'org-1',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.creatorId).toBeNull();
    expect(results[0]?.creatorTypeId).toBeNull();
  });

  it('selects item_creator_id and item_creator_type_id in the SQL', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentUserStrikeActions({ orgId: 'org-1', limit: 5 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('item_creator_id');
    expect(sentSql).toContain('item_creator_type_id');
  });
});

describe('ClickhouseActionExecutionsAdapter.getRecentModeratorActions', () => {
  const groupRow = (overrides: Record<string, unknown> = {}) => ({
    correlation_id: 'manual-action-run:abc',
    last_ts: '2026-08-05 12:00:00.000',
    group_actor_id: 'user-7',
    group_item_type_id: 'post',
    group_actor_note: 'spam sweep',
    group_policies: '[{"id":"pol-1","name":"Spam"}]',
    action_ids: ['act-1', 'act-2'],
    item_count: '3',
    failed_count: '0',
    ...overrides,
  });

  it('collapses one bulk operation into a single record', async () => {
    const { adapter } = makeAdapter([groupRow()]);

    const result = await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
    });

    expect(result).toEqual([
      {
        correlationId: 'manual-action-run:abc',
        actorId: 'user-7',
        itemTypeId: 'post',
        actionIds: ['act-1', 'act-2'],
        policyIds: ['pol-1'],
        actorNote: 'spam sweep',
        itemCount: 3,
        failedCount: 0,
        occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      },
    ]);
  });

  it('reports how many items failed', async () => {
    const { adapter } = makeAdapter([
      groupRow({ item_count: '500', failed_count: '3' }),
    ]);

    const [group] = await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
    });

    expect(group.itemCount).toBe(500);
    expect(group.failedCount).toBe(3);
  });

  it('counts items exactly rather than estimating', async () => {
    // uniq() is HyperLogLog. An "84 items" label that reads 83 is a bug the
    // reader cannot detect.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('uniqExact(item_id)');
    expect(sentSql).not.toMatch(/[^a-zA-Z]uniq\(/);
  });

  it('counts failures in items, not executions', async () => {
    // countIf counts (item, action) rows, so a 2-item x 2-action run that fails
    // completely would report "4 of 2 failed".
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('uniqExactIf(item_id, failed = 1)');
    expect(sentSql).not.toContain('countIf(');
  });

  it('scopes to moderator action sources rather than a null job id', async () => {
    // Rule-driven and user-strike executions also carry a null job_id, so
    // filtering on that would pull automation into the feed.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain("action_source IN ('manual-action-run')");
    expect(sentSql).not.toContain('job_id');
    expect(sentSql).toContain('GROUP BY correlation_id');
  });

  it('reaches forward to an endTime later than now, so a future-dated row is recoverable', async () => {
    // Deriving the ds ceiling from the cursor alone made a row dated ahead of
    // the server clock permanently unreachable — page 1's ceiling is `now`,
    // paging only moves backwards, and no filter could widen it. Clock skew on
    // a writer host is enough to produce one.
    const { adapter, query } = makeAdapter([]);
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      before: future,
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain(
      `ds <= toDate('${future.toISOString().slice(0, 10)}') + 1`,
    );
    expect(sentSql).toContain(
      `max(ts) <= parseDateTime64BestEffort('${future.toISOString()}')`,
    );
  });

  it('keeps a run straddling the start date whole', async () => {
    // A bulk run beginning just before the start date and finishing just after
    // must not lose its earlier rows — that would group into a partial record
    // with a wrong item count, the same defect the cursor fix addresses.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      after: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(query.mock.calls[0][0]).toContain("toDate('2026-08-01') - 1");
  });

  it('filters to operations that touched a given item', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      itemId: 'usr_8813',
    });

    expect(query.mock.calls[0][0]).toContain(
      "has(groupUniqArray(item_id), 'usr_8813')",
    );
  });

  it('does not alias the aggregate to `ts`', async () => {
    // ClickHouse resolves `ts < ?` in WHERE against a `max(ts) AS ts` alias and
    // rejects the query with ILLEGAL_AGGREGATION. Mocked rows can't catch this,
    // so assert the alias directly.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('max(ts) AS last_ts');
    expect(sentSql).not.toContain('max(ts) AS ts');
    expect(sentSql).toContain('ORDER BY last_ts DESC');
  });

  it('gives every aggregate an alias no raw column can resolve to', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    const sentSql = query.mock.calls[0][0];
    for (const column of [
      'actor_id',
      'item_type_id',
      'actor_note',
      'policies',
    ]) {
      expect(sentSql).not.toContain(`any(${column}) AS ${column}`);
    }
    expect(sentSql).toContain('any(actor_id) AS group_actor_id');
    expect(sentSql).toContain('any(policies) AS group_policies');
  });

  it('reads timestamps as UTC even though ClickHouse omits the zone', async () => {
    const { adapter } = makeAdapter([
      groupRow({ last_ts: '2026-08-05 12:00:00.000' }),
    ]);

    const [group] = await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
    });

    expect(group.occurredAt.toISOString()).toBe('2026-08-05T12:00:00.000Z');
  });

  it('scopes to the requested moderators', async () => {
    // Without this the reviewer filter would narrow decisions while still
    // showing every other moderator's actions.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      actorIds: ['user-7', 'user-8'],
    });

    expect(query.mock.calls[0][0]).toContain(
      "actor_id IN ('user-7', 'user-8')",
    );
  });

  it('matches policies through the policies JSON, not the unpopulated column', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      policyIds: ['pol-1'],
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('JSONExtractArrayRaw(policies)');
    expect(sentSql).toContain("['pol-1']");
    expect(sentSql).not.toContain('policy_ids');
  });

  it('omits optional filters entirely when not supplied', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      actorIds: [],
      policyIds: [],
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).not.toContain('actor_id IN');
    expect(sentSql).not.toContain('JSONExtractArrayRaw');
  });

  it('tightens the ds floor to a user-set start date', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      cursor: {
        ts: new Date('2026-08-05T12:00:00.000Z'),
        correlationId: 'manual-action-run:abc',
      },
      after: new Date('2026-08-01T00:00:00.000Z'),
    });

    const sentSql = query.mock.calls[0][0];
    // The rolling window would reach back months; the start date wins, minus a
    // day of slack so a run straddling midnight is not truncated.
    expect(sentSql).toContain("toDate('2026-08-01') - 1");
    // `after` is an exact bound on the complete group, so it lives in HAVING.
    expect(sentSql).toContain(
      "max(ts) >= parseDateTime64BestEffort('2026-08-01T00:00:00.000Z')",
    );
  });

  it('tolerates null aggregate columns', async () => {
    const { adapter } = makeAdapter([
      groupRow({
        group_actor_id: null,
        group_item_type_id: null,
        group_actor_note: null,
        group_policies: null,
        action_ids: null,
        item_count: null,
        failed_count: null,
      }),
    ]);

    const [group] = await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
    });

    expect(group.actionIds).toEqual([]);
    expect(group.policyIds).toEqual([]);
    expect(group.itemCount).toBe(0);
    expect(group.failedCount).toBe(0);
  });

  it('applies the cursor to the complete group, not to raw rows', async () => {
    // A bulk run trickles in over seconds (pLimit(10) in ActionApi). Bounding
    // raw `ts` before GROUP BY truncates a run straddling the cursor into a
    // partial group with a lower max(ts) and itemCount, so the same run lands
    // on two consecutive pages with wrong counts on both.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      cursor: {
        ts: new Date('2026-08-05T12:00:00.000Z'),
        correlationId: 'manual-action-run:abc',
      },
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('HAVING');
    expect(sentSql).toContain(
      "(max(ts), correlation_id) < (parseDateTime64BestEffort('2026-08-05T12:00:00.000Z'), 'manual-action-run:abc')",
    );
    // The cursor must not appear as a raw-row predicate.
    expect(sentSql).not.toMatch(/WHERE[\s\S]*\bts\s*<\s*'/);
  });

  it('orders by the composite key so ties cannot repeat or vanish', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100 });

    expect(query.mock.calls[0][0]).toContain(
      'ORDER BY last_ts DESC, correlation_id DESC',
    );
  });

  it('bounds the upper end of a date range on the complete group', async () => {
    // Without this, a January filter renders today's bulk runs beside January
    // decisions: endTime reaches Postgres but never reaches this store.
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 100,
      after: new Date('2026-01-01T00:00:00.000Z'),
      before: new Date('2026-01-31T23:59:59.000Z'),
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain(
      "max(ts) <= parseDateTime64BestEffort('2026-01-31T23:59:59.000Z')",
    );
    expect(sentSql).toContain(
      "max(ts) >= parseDateTime64BestEffort('2026-01-01T00:00:00.000Z')",
    );
  });

  it('caps the page limit at the server maximum', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({ orgId: 'org-1', limit: 100_000 });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('LIMIT 200');
    expect(sentSql).not.toContain('LIMIT 100000');
  });

  it('keeps the limit placeholder bound when later filters add parameters', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getRecentModeratorActions({
      orgId: 'org-1',
      limit: 25,
      itemId: 'i-1',
      cursor: {
        ts: new Date('2026-08-05T12:00:00.000Z'),
        correlationId: 'manual-action-run:abc',
      },
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain("has(groupUniqArray(item_id), 'i-1')");
    expect(sentSql).toContain('LIMIT 25');
    expect(sentSql).not.toContain('?');
  });

  it('refuses a page limit that is not a finite number', async () => {
    const { adapter } = makeAdapter([]);

    await expect(
      adapter.getRecentModeratorActions({
        orgId: 'org-1',
        limit:
          '100; DROP TABLE analytics.ACTION_EXECUTIONS' as unknown as number,
      }),
    ).rejects.toThrow('finite number');
  });
});

describe('ClickhouseActionExecutionsAdapter.getManualActionItems', () => {
  it('returns one record per item with its failure state', async () => {
    const { adapter } = makeAdapter([
      { item_id: 'i-1', item_type_id: 'post', failed: 0, total_count: '3' },
      { item_id: 'i-2', item_type_id: 'post', failed: 1, total_count: '3' },
    ]);

    const result = await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'manual-action-run:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 100,
      offset: 0,
    });

    expect(result).toEqual({
      items: [
        { itemId: 'i-1', itemTypeId: 'post', failed: false },
        { itemId: 'i-2', itemTypeId: 'post', failed: true },
      ],
      totalCount: 3,
    });
  });

  it('caps the scan at occurredAt but sets no floor, so it cannot see less than the feed', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'manual-action-run:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 100,
      offset: 0,
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain("ds <= toDate('2026-08-05') + 1");
    expect(sentSql).not.toContain('ds >=');
    expect(sentSql).toContain("correlation_id = 'manual-action-run:abc'");
  });

  it('reads only moderator actions, not any correlation id', async () => {
    // mrt-decision / rule-driven correlation ids must not resolve here — their
    // item lists are what the NCMEC permission gate exists to hide.
    const { adapter, query } = makeAdapter([]);

    await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'mrt-decision:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 100,
      offset: 0,
    });

    expect(query.mock.calls[0][0]).toContain(
      "action_source IN ('manual-action-run')",
    );
  });

  it('reports zero total when the operation has no rows', async () => {
    const { adapter } = makeAdapter([]);

    const result = await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'manual-action-run:missing',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 100,
      offset: 0,
    });

    expect(result).toEqual({ items: [], totalCount: 0 });
  });

  it('caps the page limit but pages past the cap with the offset', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'manual-action-run:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 100_000,
      offset: 400,
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('LIMIT 200 OFFSET 400');
    expect(sentSql).not.toContain('?');
  });

  it('floors a negative offset to the first page', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getManualActionItems({
      orgId: 'org-1',
      correlationId: 'manual-action-run:abc',
      occurredAt: new Date('2026-08-05T12:00:00.000Z'),
      limit: 50,
      offset: -5,
    });

    expect(query.mock.calls[0][0]).toContain('LIMIT 50 OFFSET 0');
  });

  it('refuses an offset that is not a finite number', async () => {
    const { adapter } = makeAdapter([]);

    await expect(
      adapter.getManualActionItems({
        orgId: 'org-1',
        correlationId: 'manual-action-run:abc',
        occurredAt: new Date('2026-08-05T12:00:00.000Z'),
        limit: 50,
        offset: '0 UNION ALL SELECT 1' as unknown as number,
      }),
    ).rejects.toThrow('finite number');
  });
});

describe('ClickhouseActionExecutionsAdapter.findContentCreatorIdentity', () => {
  it('returns null when no rows match', async () => {
    const { adapter } = makeAdapter([]);

    const result = await adapter.findContentCreatorIdentity({
      orgId: 'org-1',
      itemId: 'content-1',
      itemTypeId: 'content-type-1',
    });

    expect(result).toBeNull();
  });

  it('projects the creator id + type id from the most-recent CONTENT row', async () => {
    const ts = '2026-05-10T12:00:00.000Z';
    const { adapter } = makeAdapter([
      {
        ts,
        item_creator_id: 'user-42',
        item_creator_type_id: 'user-type-A',
      },
    ]);

    const result = await adapter.findContentCreatorIdentity({
      orgId: 'org-1',
      itemId: 'content-1',
      itemTypeId: 'content-type-1',
    });

    expect(result).toEqual({
      creatorId: 'user-42',
      creatorTypeId: 'user-type-A',
      lastSeenAt: new Date(ts),
    });
  });

  it('returns null when the row has empty creator fields', async () => {
    const { adapter } = makeAdapter([
      {
        ts: '2026-05-10T12:00:00.000Z',
        item_creator_id: null,
        item_creator_type_id: 'user-type-A',
      },
    ]);

    const result = await adapter.findContentCreatorIdentity({
      orgId: 'org-1',
      itemId: 'content-1',
      itemTypeId: 'content-type-1',
    });

    expect(result).toBeNull();
  });

  it('filters to CONTENT rows with non-empty creator columns and uses LIMIT 1', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.findContentCreatorIdentity({
      orgId: 'org-1',
      itemId: 'content-1',
      itemTypeId: 'content-type-1',
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('analytics.ACTION_EXECUTIONS');
    expect(sentSql).toContain("item_type_kind = 'CONTENT'");
    expect(sentSql).toContain('item_creator_id IS NOT NULL');
    expect(sentSql).toContain("item_creator_id != ''");
    expect(sentSql).toContain('item_creator_type_id IS NOT NULL');
    expect(sentSql).toContain("item_creator_type_id != ''");
    expect(sentSql).toContain('LIMIT 1');
  });

  it('passes the item type id to disambiguate from other content with the same id', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.findContentCreatorIdentity({
      orgId: 'org-1',
      itemId: 'content-1',
      itemTypeId: 'content-type-PHOTO',
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('content-type-PHOTO');
  });
});

describe('ClickhouseActionExecutionsAdapter.getItemActionHistory', () => {
  const historyInput = {
    orgId: 'org-1',
    itemId: 'user-1',
    itemTypeId: 'user-type-A',
    itemSubmissionTime: undefined,
  };

  function actionRow(overrides: Record<string, unknown> = {}) {
    return {
      ts: '2026-06-01T10:00:00.000Z',
      item_id: 'user-1',
      item_type_id: 'user-type-A',
      item_creator_id: null,
      item_creator_type_id: null,
      actor_id: 'moderator-1',
      job_id: null,
      policies: '[]',
      rules: '[]',
      action_id: 'action-ban',
      ...overrides,
    };
  }

  it('exposes the moderator-supplied parameters for the execution', async () => {
    const { adapter } = makeAdapter([
      actionRow({ parameters: '{"num_days":7,"reason":"spam"}' }),
    ]);

    const results = await adapter.getItemActionHistory(historyInput);

    expect(results).toHaveLength(1);
    expect(results[0]?.parameters).toEqual({ num_days: 7, reason: 'spam' });
  });

  it('returns an empty object when the action took no parameters', async () => {
    const { adapter } = makeAdapter([actionRow({ parameters: '{}' })]);

    const results = await adapter.getItemActionHistory(historyInput);

    expect(results[0]?.parameters).toEqual({});
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty string', ''],
  ])(
    'returns an empty object when the stored value is %s',
    async (_label, stored) => {
      const { adapter } = makeAdapter([actionRow({ parameters: stored })]);

      const results = await adapter.getItemActionHistory(historyInput);

      expect(results[0]?.parameters).toEqual({});
    },
  );

  it.each([
    ['unparseable text', 'not-json'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON scalar', '42'],
  ])(
    'returns an empty object without failing the query when the value is %s',
    async (_label, stored) => {
      const { adapter } = makeAdapter([
        actionRow({ action_id: 'action-a', parameters: stored }),
        actionRow({ action_id: 'action-b', parameters: '{"num_days":3}' }),
      ]);

      const results = await adapter.getItemActionHistory(historyInput);

      expect(results).toHaveLength(2);
      expect(results[0]?.parameters).toEqual({});
      // The sibling row in the same result set stays intact.
      expect(results[1]?.parameters).toEqual({ num_days: 3 });
    },
  );

  it('selects the parameters column in the SQL', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.getItemActionHistory(historyInput);

    expect(query.mock.calls[0]?.[0]).toMatch(/\bparameters\b/);
  });
});
