import { resolvers } from './insights.js';

const Query = resolvers.Query as {
  getFullReportingRuleResultForItem: (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => Promise<unknown>;
};

describe('ReportingRuleInsights resolvers', () => {
  it('fetches and normalizes a report sample within the authenticated org', async () => {
    const exactExecutionTimestamp = '2026-08-09T12:34:56.789Z';
    const sample = {
      date: new Date('2026-08-09T00:00:00.000Z'),
      ts: new Date('2026-08-09T12:34:56.000Z'),
      itemId: 'item-1',
      itemTypeName: 'post',
      itemTypeId: 'item-type-1',
      itemData: { body: 'reported content' },
      creatorId: 'creator-1',
      creatorTypeId: 'creator-type-1',
      result: '{"conjunction":"AND","conditions":[]}',
      environment: 'PRODUCTION',
      policyIds: ['policy-1'],
    };
    const getReportingRulePassingContentSamples = jest.fn(async () => [sample]);
    const getReportingRules = jest.fn(async () => [
      { id: 'report-rule-1', name: 'Report rule' },
    ]);
    const proactiveSamples = jest.fn();
    const context = {
      getUser: () => ({ id: 'user-1', orgId: 'org-1' }),
      services: {
        ReportingService: {
          getReportingRulePassingContentSamples,
          getReportingRules,
        },
      },
      dataSources: {
        ruleAPI: { ruleInsights: { getRuleContentSamples: proactiveSamples } },
      },
    };

    const result = await Query.getFullReportingRuleResultForItem(
      {},
      {
        input: {
          ruleId: 'report-rule-1',
          item: { id: 'item-1', typeId: 'item-type-1' },
          date: exactExecutionTimestamp,
          lookback: 'PRIOR',
        },
      },
      context,
    );

    expect(getReportingRulePassingContentSamples).toHaveBeenCalledWith({
      orgId: 'org-1',
      ruleId: 'report-rule-1',
      itemIds: ['item-1'],
      itemTypeIds: ['item-type-1'],
      executionTimestamp: new Date(exactExecutionTimestamp),
      numSamples: 1,
      source: 'priorVersion',
    });
    expect(getReportingRules).toHaveBeenCalledWith({ orgId: 'org-1' });
    expect(result).toEqual({
      __typename: 'ReportingRuleExecutionResult',
      ...sample,
      itemData: '{"body":"reported content"}',
      result: { conjunction: 'AND', conditions: [] },
      passed: true,
      ruleId: 'report-rule-1',
      ruleName: 'Report rule',
    });
    expect(proactiveSamples).not.toHaveBeenCalled();
  });

  it('returns NotFound when an in-org exact sample lookup is empty', async () => {
    const getReportingRulePassingContentSamples = jest.fn(async () => []);
    const context = {
      getUser: () => ({ id: 'user-1', orgId: 'org-1' }),
      services: {
        ReportingService: {
          getReportingRulePassingContentSamples,
          getReportingRules: jest.fn(async () => [
            { id: 'report-rule-1', name: 'Report rule' },
          ]),
        },
      },
    };
    const exactExecutionTimestamp = '2026-08-10T14:15:16.789Z';

    const result = await Query.getFullReportingRuleResultForItem(
      {},
      {
        input: {
          ruleId: 'report-rule-1',
          item: { id: 'item-2', typeId: 'item-type-2' },
          date: exactExecutionTimestamp,
          lookback: 'LATEST',
        },
      },
      context,
    );

    expect(result).toMatchObject({ __typename: 'NotFoundError' });
    expect(getReportingRulePassingContentSamples).toHaveBeenCalledWith({
      orgId: 'org-1',
      ruleId: 'report-rule-1',
      itemIds: ['item-2'],
      itemTypeIds: ['item-type-2'],
      executionTimestamp: new Date(exactExecutionTimestamp),
      numSamples: 1,
      source: 'latestVersion',
    });
  });

  it('returns NotFound without fetching samples when the rule is outside the org', async () => {
    const getReportingRulePassingContentSamples = jest.fn();
    const context = {
      getUser: () => ({ id: 'user-1', orgId: 'org-1' }),
      services: {
        ReportingService: {
          getReportingRulePassingContentSamples,
          getReportingRules: jest.fn(async () => []),
        },
      },
    };

    const result = await Query.getFullReportingRuleResultForItem(
      {},
      {
        input: {
          ruleId: 'rule-from-another-org',
          item: { id: 'item-1', typeId: 'item-type-1' },
          date: '2026-08-09T12:34:56.000Z',
          lookback: 'LATEST',
        },
      },
      context,
    );

    expect(result).toMatchObject({ __typename: 'NotFoundError' });
    expect(getReportingRulePassingContentSamples).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['malformed', { date: 'not-a-timestamp' }],
  ])(
    'returns NotFound without fetching samples when the timestamp is %s',
    async (_, timestampInput) => {
      const getReportingRulePassingContentSamples = jest.fn(async () => []);
      const context = {
        getUser: () => ({ id: 'user-1', orgId: 'org-1' }),
        services: {
          ReportingService: {
            getReportingRulePassingContentSamples,
            getReportingRules: jest.fn(async () => [
              { id: 'report-rule-1', name: 'Report rule' },
            ]),
          },
        },
      };

      const result = await Query.getFullReportingRuleResultForItem(
        {},
        {
          input: {
            ruleId: 'report-rule-1',
            item: { id: 'item-1', typeId: 'item-type-1' },
            lookback: 'LATEST',
            ...timestampInput,
          },
        },
        context,
      );

      expect(result).toMatchObject({ __typename: 'NotFoundError' });
      expect(getReportingRulePassingContentSamples).not.toHaveBeenCalled();
    },
  );
});
