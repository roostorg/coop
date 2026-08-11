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
    const getReportingRulePassingContentSamples = jest.fn(async () => []);
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
    await ReportingRuleInsights.latestVersionSamples(rule, {}, context);
    await ReportingRuleInsights.priorVersionSamples(rule, {}, context);

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
    expect(proactivePassRateData).not.toHaveBeenCalled();
    expect(proactivePassingContentSamples).not.toHaveBeenCalled();
  });
});
