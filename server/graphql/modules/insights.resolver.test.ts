import { resolvers } from './insights.js';

const ReportingRuleInsights = resolvers.ReportingRuleInsights as {
  passRateData: (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => Promise<unknown>;
  latestVersionSamples: (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => Promise<unknown>;
  priorVersionSamples: (
    parent: unknown,
    args: unknown,
    context: unknown,
  ) => Promise<unknown>;
};

describe('ReportingRuleInsights resolvers', () => {
  it('delegates report analytics to ReportingService', async () => {
    const getReportingRulePassRateData = jest.fn(async () => []);
    const latestSample = {
      date: new Date('2026-08-09T00:00:00.000Z'),
      ts: new Date('2026-08-09T12:34:56.000Z'),
      itemId: 'item-latest',
      itemTypeName: 'post',
      itemTypeId: 'item-type-1',
      creatorId: 'creator-1',
      creatorTypeId: 'creator-type-1',
      itemData: '{"body":"latest"}',
      result: '{"signalResults":[{"signalName":"toxicity"}]}',
      environment: 'PRODUCTION',
      ruleId: 'warehouse-rule-id',
      ruleName: 'Warehouse rule name',
      passed: false,
      policyIds: ['policy-1'],
    };
    const priorSample = {
      ...latestSample,
      itemId: 'item-prior',
      itemData: { body: 'prior' },
      result: { signalResults: [{ signalName: 'spam' }] },
      creatorId: null,
      creatorTypeId: null,
      policyIds: ['policy-2'],
    };
    const getReportingRulePassingContentSamples = jest
      .fn()
      .mockResolvedValueOnce([latestSample])
      .mockResolvedValueOnce([priorSample]);
    const proactivePassRateData = jest.fn(async () => []);
    const proactivePassingContentSamples = jest.fn(async () => []);
    const context = {
      getUser: () => ({ id: 'user-1', orgId: 'org-1' }),
      services: {
        ReportingService: {
          getReportingRulePassRateData,
          getReportingRulePassingContentSamples,
        },
      },
      dataSources: {
        ruleAPI: {
          ruleInsights: {
            getRulePassRateData: proactivePassRateData,
            getRulePassingContentSamples: proactivePassingContentSamples,
          },
        },
      },
    };
    const rule = { id: 'report-rule-1', orgId: 'org-1', name: 'Report rule' };
    const startDate = '2026-08-01';

    await ReportingRuleInsights.passRateData(
      rule,
      { lookbackStartDate: startDate },
      context,
    );
    const latestSamples = await ReportingRuleInsights.latestVersionSamples(
      rule,
      {},
      context,
    );
    const priorSamples = await ReportingRuleInsights.priorVersionSamples(
      rule,
      {},
      context,
    );

    expect(getReportingRulePassRateData).toHaveBeenCalledWith({
      orgId: 'org-1',
      ruleId: 'report-rule-1',
      startDate: new Date(startDate),
    });
    expect(getReportingRulePassingContentSamples).toHaveBeenNthCalledWith(1, {
      orgId: 'org-1',
      ruleId: 'report-rule-1',
      source: 'latestVersion',
      numSamples: 300,
    });
    expect(getReportingRulePassingContentSamples).toHaveBeenNthCalledWith(2, {
      orgId: 'org-1',
      ruleId: 'report-rule-1',
      source: 'priorVersion',
      numSamples: 300,
    });
    expect(latestSamples).toEqual([
      {
        ...latestSample,
        result: { signalResults: [{ signalName: 'toxicity' }] },
        passed: true,
        ruleId: rule.id,
        ruleName: rule.name,
      },
    ]);
    expect(priorSamples).toEqual([
      {
        ...priorSample,
        itemData: '{"body":"prior"}',
        passed: true,
        ruleId: rule.id,
        ruleName: rule.name,
      },
    ]);
    expect(proactivePassRateData).not.toHaveBeenCalled();
    expect(proactivePassingContentSamples).not.toHaveBeenCalled();
  });
});
