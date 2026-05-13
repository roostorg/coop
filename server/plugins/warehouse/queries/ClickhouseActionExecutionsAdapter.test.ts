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
