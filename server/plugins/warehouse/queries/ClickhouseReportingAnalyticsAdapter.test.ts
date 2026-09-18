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

describe('ClickhouseReportingAnalyticsAdapter.getReportingRulePassRateData', () => {
  it('formats the start date for ClickHouse DateTime64 comparison', async () => {
    const { adapter, query } = makeAdapter();

    await adapter.getReportingRulePassRateData({
      orgId: 'org-pass-rate',
      ruleId: 'rule-pass-rate',
      startDate: new Date('2025-08-11T18:15:34.135Z'),
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, , params] = query.mock.calls[0];
    expect(sql).toContain('ts_start_inclusive > parseDateTime64BestEffort(?)');
    expect(params).toEqual([
      'org-pass-rate',
      'rule-pass-rate',
      '2025-08-11T18:15:34.135Z',
    ]);
  });

  it('preserves ClickHouse dates while normalizing numeric totals', async () => {
    const { adapter, query } = makeAdapter();
    query.mockResolvedValueOnce([
      {
        date: '2026-08-04',
        totalMatches: '12',
        totalRequests: '34',
      },
    ]);

    const result = await adapter.getReportingRulePassRateData({
      orgId: 'org-pass-rate',
      ruleId: 'rule-pass-rate',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result).toEqual([
      {
        date: '2026-08-04',
        totalMatches: 12,
        totalRequests: 34,
      },
    ]);
  });
});

describe('ClickhouseReportingAnalyticsAdapter.getReportingRulePassingContentSamples', () => {
  it('formats latest-version timestamp and date bounds for ClickHouse', async () => {
    const { adapter, query } = makeAdapter();

    await adapter.getReportingRulePassingContentSamples({
      orgId: 'org-latest',
      ruleId: 'rule-latest',
      numSamples: 10,
      filter: {
        type: 'latestVersion',
        minVersion: '2026-08-11T14:46:07.472Z',
        minDate: new Date('2026-08-11T23:30:00.000-02:00'),
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, , params] = query.mock.calls[0];
    expect(sql).toContain('rule_version >= parseDateTime64BestEffort(?)');
    expect(sql).toContain('ds >= toDate(?)');
    expect(params).toEqual([
      'org-latest',
      'rule-latest',
      '2026-08-11T14:46:07.472Z',
      '2026-08-12',
    ]);
  });

  it('formats prior-version timestamp and date bounds for ClickHouse', async () => {
    const { adapter, query } = makeAdapter();

    await adapter.getReportingRulePassingContentSamples({
      orgId: 'org-prior',
      ruleId: 'rule-prior',
      itemIds: ['item-1'],
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
    expect(sql).toContain('rule_version >= parseDateTime64BestEffort(?)');
    expect(sql).toContain('rule_version < parseDateTime64BestEffort(?)');
    expect(sql).toContain('ds >= toDate(?)');
    expect(sql).toContain('ds <= toDate(?)');
    expect(params).toEqual([
      'org-prior',
      'rule-prior',
      'item-1',
      '2026-07-01T01:02:03.004Z',
      '2026-08-11T14:46:07.472Z',
      '2026-07-01',
      '2026-08-12',
    ]);
  });
});
