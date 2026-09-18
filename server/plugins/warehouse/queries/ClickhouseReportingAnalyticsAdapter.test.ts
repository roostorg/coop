import { ProxyTracerProvider } from '@opentelemetry/api';

import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import SafeTracer from '../../../utils/SafeTracer.js';
import { ClickhouseReportingAnalyticsAdapter } from './ClickhouseReportingAnalyticsAdapter.js';

function makeAdapter() {
  const query = jest.fn(
    async (
      _sql: string,
      _tracer: SafeTracer,
      _params?: readonly unknown[],
    ): Promise<unknown[]> => [],
  );
  const warehouse: IDataWarehouse = {
    query,
    transaction: jest.fn(),
    start: jest.fn(),
    close: jest.fn(),
    getProvider: jest.fn(),
  };
  const tracer = new SafeTracer(new ProxyTracerProvider().getTracer('noop'));

  return {
    adapter: new ClickhouseReportingAnalyticsAdapter(warehouse, tracer),
    query,
  };
}

describe('ClickhouseReportingAnalyticsAdapter.getReportingRulePassingContentSamples', () => {
  it('selects sample timestamps as UTC ISO strings and preserves their instant', async () => {
    const { adapter, query } = makeAdapter();
    query.mockResolvedValueOnce([
      {
        date: '2026-08-11',
        ts_iso: '2026-08-11T16:38:00.000Z',
        item_id: 'item-1',
        item_type_name: 'Post',
        item_type_id: 'post',
        item_creator_id: null,
        item_creator_type_id: null,
        item_data: {},
        result: {},
        rule_environment: null,
        rule_id: 'rule-1',
        rule_name: 'Rule 1',
        passed: 1,
        policy_ids: [],
      },
    ]);

    const result = await adapter.getReportingRulePassingContentSamples({
      orgId: 'org-1',
      ruleId: 'rule-1',
      numSamples: 1,
      filter: {
        type: 'latestVersion',
        minVersion: '2026-08-01T00:00:00.000Z',
        minDate: new Date('2026-08-01T00:00:00.000Z'),
      },
    });

    const [sql] = query.mock.calls[0];
    expect(sql).toContain(
      "formatDateTime(ts, '%Y-%m-%dT%H:%i:%s.%fZ', 'UTC') AS ts_iso",
    );
    expect(result[0]?.ts.toISOString()).toBe('2026-08-11T16:38:00.000Z');
  });

  it('formats prior-version timestamp and date bounds for ClickHouse', async () => {
    const { adapter, query } = makeAdapter();

    await adapter.getReportingRulePassingContentSamples({
      orgId: 'org-prior',
      ruleId: 'rule-prior',
      itemIds: ['item-1'],
      itemTypeIds: ['post'],
      executionTimestamp: new Date('2026-07-15T12:34:56.789Z'),
      numSamples: 5,
      filter: {
        type: 'priorVersion',
        fromVersion: '2026-07-01T01:02:03.004Z',
        toVersion: '2026-08-11T14:46:07.472Z',
        fromDate: new Date('2026-06-30T23:30:00.000-02:00'),
        toDate: new Date('2026-08-11T23:30:00.000-02:00'),
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, , params] = query.mock.calls[0];
    expect(sql).toContain('rule_version >= ?');
    expect(sql).toContain('rule_version < ?');
    expect(sql).toContain('ds >= toDate(?)');
    expect(sql).toContain('ds <= toDate(?)');
    expect(sql).toContain('item_type_id IN (?)');
    expect(sql).toContain('ts = parseDateTime64BestEffort(?)');
    expect(params).toEqual([
      'org-prior',
      'rule-prior',
      'item-1',
      'post',
      '2026-07-15T12:34:56.789Z',
      new Date('2026-07-01T01:02:03.004Z'),
      new Date('2026-08-11T14:46:07.472Z'),
      new Date('2026-06-30T23:30:00.000-02:00'),
      new Date('2026-08-11T23:30:00.000-02:00'),
    ]);
  });
});
