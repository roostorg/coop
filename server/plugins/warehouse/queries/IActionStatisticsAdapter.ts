import { type ReadonlyDeep } from 'type-fest';

export type ActionStatisticsTimeDivisionOptions = 'DAY' | 'HOUR';

export type ActionExecutionsGroupByAllowedFields =
  | 'RULE_ID'
  | 'ACTION_ID'
  | 'ITEM_TYPE_ID'
  | 'ACTION_SOURCE'
  | 'POLICY_ID';

export type ActionSourceOptions =
  | 'automated-rule'
  | 'mrt-decision'
  | 'manual-action-run'
  | 'post-actions';

export type ActionCountsInput = ReadonlyDeep<{
  orgId: string;
  groupBy: ActionExecutionsGroupByAllowedFields;
  filterBy: {
    actionIds: string[];
    itemTypeIds: string[];
    policyIds: string[];
    sources: ActionSourceOptions[];
    startDate: Date;
    endDate: Date;
  };
  timeDivision: ActionStatisticsTimeDivisionOptions;
  timeZone: string;
}>;

export interface IActionStatisticsAdapter {
  getActionedSubmissionCountsByDay(
    orgId: string,
    startAt: Date,
  ): Promise<ReadonlyArray<{ date: string; count: number }>>;

  getActionedSubmissionCountsByTagByDay(
    orgId: string,
    startAt: Date,
  ): Promise<
    ReadonlyArray<{ date: string; tag: string; count: number }>
  >;

  getActionedSubmissionCountsByPolicyByDay(
    orgId: string,
    startAt: Date,
  ): Promise<
    ReadonlyArray<{
      date: string;
      count: number;
      policy: { id: string; name: string };
    }>
  >;

  getActionedSubmissionCountsByActionByDay(
    orgId: string,
    startAt: Date,
  ): Promise<
    ReadonlyArray<{
      date: string;
      count: number;
      action: { name: string };
    }>
  >;

  getActionCountsPerDay(
    orgId: string,
    startAt: Date,
  ): Promise<ReadonlyArray<{ date: string; count: number }>>;

  getPoliciesSortedByViolationCount(input: {
    filterBy: { startDate: Date; endDate: Date };
    timeZone: string;
    orgId: string;
  }): Promise<ReadonlyArray<{ count: number; policy_id: string }>>;

  getAllActionCountsGroupByPolicy(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{ count: number; policy_id: string; time: string }>
  >;

  getAllActionCountsGroupByActionId(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{ count: number; action_id: string; time: string }>
  >;

  getAllActionCountsGroupBySource(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{ count: number; source: string; time: string }>
  >;

  getAllActionCountsGroupByItemTypeId(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{ count: number; item_type_id: string; time: string }>
  >;

  getAllActionCountsGroupByRule(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{ count: number; rule_id: string; time: string }>
  >;

  getAllActionCountsGroupBy(
    input: ActionCountsInput,
  ): Promise<
    ReadonlyArray<{
      count: number;
      action_id?: string;
      source?: string;
      item_type_id?: string;
      time: string;
    }>
  >;
}

