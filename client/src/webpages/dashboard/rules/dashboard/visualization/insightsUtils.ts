import {
  GQLActionStatisticsGroupByColumns,
  GQLCountByPolicyByDay,
  GQLPolicy,
} from '@/graphql/generated';
import type { WithoutTypename } from '@/graphql/inputHelpers';
import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
import mapValues from 'lodash/mapValues';
import sum from 'lodash/sum';
import uniq from 'lodash/uniq';

export function rollUpPolicyCounts(
  policies: ReadonlyArray<Omit<GQLPolicy, 'penalty'>>,
  actionedSubmissionsByPolicyByDay: ReadonlyArray<GQLCountByPolicyByDay>,
): readonly WithoutTypename<GQLCountByPolicyByDay>[] {
  if (policies.length === 0) {
    return [];
  }

  type Policy = (typeof policies)[number];

  const parentPoliciesToChildren = groupBy(
    policies,
    (it) => it?.parentId ?? '',
  );
  function getPolicySubtree(rootPolicy: Policy): Policy[] {
    return [
      rootPolicy,
      ...(parentPoliciesToChildren[rootPolicy.id] ?? []).flatMap(
        getPolicySubtree,
      ),
    ];
  }
  const actionedSubmissionCountsByPolicyIdByDate = mapValues(
    groupBy(actionedSubmissionsByPolicyByDay, (it) => it.policy.id),
    (countsForPolicy) => keyBy(countsForPolicy, (it) => it.date.toString()),
  );
  const allDates = uniq(actionedSubmissionsByPolicyByDay.map((it) => it.date));

  return parentPoliciesToChildren['']
    .flatMap((policy) =>
      allDates.map((date) => ({
        policy,
        date,
        count: sum(
          getPolicySubtree(policy).map(
            (it) =>
              actionedSubmissionCountsByPolicyIdByDate[it.id]?.[date.toString()]
                ?.count ?? 0,
          ),
        ),
      })),
    )
    .filter((it) => it.count > 0);
}

export function getDisplayNameForGroupByOption(
  option: GQLActionStatisticsGroupByColumns,
) {
  switch (option) {
    case GQLActionStatisticsGroupByColumns.RuleId:
      return 'Rule';
    case GQLActionStatisticsGroupByColumns.PolicyId:
      return 'Policy';
    case GQLActionStatisticsGroupByColumns.ActionId:
      return 'Action';
    case GQLActionStatisticsGroupByColumns.ItemTypeId:
      return 'Item Type';
    case GQLActionStatisticsGroupByColumns.ActionSource:
      return 'Source';
  }
}
