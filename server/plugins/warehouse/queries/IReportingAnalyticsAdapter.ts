export interface ReportsByDayRow {
  date: string;
  count: number;
}

export interface ReportingRulePassRateRow {
  totalMatches: number;
  totalRequests: number;
  date: string;
}

export type ReportingRuleSampleSource = 'latestVersion' | 'priorVersion';

export type ReportingRuleSampleFilter =
  | {
      type: 'latestVersion';
      minVersion: string;
      minDate: Date;
    }
  | {
      type: 'priorVersion';
      fromVersion: string;
      toVersion: string;
      fromDate: Date;
      toDate: Date;
    };

export interface ReportingRulePassingContentSample {
  date: Date;
  ts: Date;
  itemId: string;
  itemTypeName: string;
  itemTypeId: string;
  creatorId: string | null;
  creatorTypeId: string | null;
  itemData: unknown;
  result: unknown;
  environment: string | null;
  ruleId: string;
  ruleName: string;
  passed: boolean;
  policyIds: readonly string[];
}

export interface ReportingRulePassingContentSampleInput {
  orgId: string;
  ruleId: string;
  itemIds?: ReadonlyArray<string>;
  numSamples: number;
  filter: ReportingRuleSampleFilter;
}

export interface ReportingRulePassRateInput {
  orgId: string;
  ruleId: string;
  startDate: Date;
}

export interface IReportingAnalyticsAdapter {
  getTotalIngestedReportsByDay(
    orgId: string,
  ): Promise<ReadonlyArray<ReportsByDayRow>>;

  getReportingRulePassRateData(
    input: ReportingRulePassRateInput,
  ): Promise<ReadonlyArray<ReportingRulePassRateRow>>;

  getReportingRulePassingContentSamples(
    input: ReportingRulePassingContentSampleInput,
  ): Promise<ReadonlyArray<ReportingRulePassingContentSample>>;

  getNumTimesReported(
    orgId: string,
    itemId: string,
  ): Promise<number | null>;
}

