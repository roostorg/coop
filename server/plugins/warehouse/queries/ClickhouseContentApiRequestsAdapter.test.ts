import { ProxyTracerProvider } from '@opentelemetry/api';

import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import SafeTracer from '../../../utils/SafeTracer.js';
import { ClickhouseContentApiRequestsAdapter } from './ClickhouseContentApiRequestsAdapter.js';

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
    adapter: new ClickhouseContentApiRequestsAdapter(warehouse, tracer),
    query,
  };
}

describe('ClickhouseContentApiRequestsAdapter.findInferredUserIdentityFromCreators', () => {
  it('returns null when no rows match', async () => {
    const { adapter } = makeAdapter([]);

    const result = await adapter.findInferredUserIdentityFromCreators({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result).toBeNull();
  });

  it('returns the most-recent creator type id when a row matches', async () => {
    const ts = '2026-05-01T12:00:00.000Z';
    const { adapter } = makeAdapter([
      { ts, item_creator_type_id: 'user-type-A' },
    ]);

    const result = await adapter.findInferredUserIdentityFromCreators({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result).toEqual({
      itemTypeId: 'user-type-A',
      lastSeenAt: new Date(ts),
    });
  });

  it('returns null when the row has a null creator type id', async () => {
    const { adapter } = makeAdapter([
      { ts: '2026-05-01T00:00:00.000Z', item_creator_type_id: null },
    ]);

    const result = await adapter.findInferredUserIdentityFromCreators({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    expect(result).toBeNull();
  });

  it('targets analytics.CONTENT_API_REQUESTS and filters to successful events', async () => {
    const { adapter, query } = makeAdapter([]);

    await adapter.findInferredUserIdentityFromCreators({
      orgId: 'org-1',
      itemId: 'i-1',
    });

    const sentSql = query.mock.calls[0][0];
    expect(sentSql).toContain('analytics.CONTENT_API_REQUESTS');
    expect(sentSql).toContain(`event = 'REQUEST_SUCCEEDED'`);
  });
});
