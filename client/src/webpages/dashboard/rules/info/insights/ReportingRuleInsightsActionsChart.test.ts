import { print } from 'graphql';
import { describe, expect, it } from 'vitest';

import { GQLReportingRulePassRateAnalyticsDocument } from '../../../../../graphql/generated';

describe('ReportingRulePassRateAnalytics', () => {
  it('queries reportingRule with the reporting rule ID', () => {
    const operation = print(GQLReportingRulePassRateAnalyticsDocument);

    expect(operation).toContain('reportingRule(id: $id)');
    expect(operation).not.toContain('rule(id: $id)');
  });
});
