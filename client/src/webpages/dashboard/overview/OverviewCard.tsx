import { Link } from '@/coop-ui/Link';
import {
  useGQLActionStatisticsDataLazyQuery,
  useGQLPolicyRollupDataLazyQuery,
  useGQLRuleNamesAndIdsLazyQuery,
  useGQLTotalPendingJobsLazyQuery,
  useGQLViolationsPerPolicyLazyQuery,
} from '@/graphql/generated';
import { ChevronDownFilled, ChevronUpFilled } from '@/icons';
import { ReactComponent as ArrowRight } from '@/icons/lni/Direction/arrow-right.svg';
import { ReactComponent as ArrowsHorizontal } from '@/icons/lni/Direction/arrows-horizontal.svg';
import { assertUnreachable } from '@/utils/misc';
import { gql } from '@apollo/client';
import {
  differenceInMilliseconds,
  formatDistance,
  subMilliseconds,
} from 'date-fns';
import groupBy from 'lodash/groupBy';
import isNaN from 'lodash/isNaN';
import partition from 'lodash/partition';
import sum from 'lodash/sum';
import { useEffect, useMemo, type SVGProps } from 'react';

import ComponentLoading from '@/components/common/ComponentLoading';

import type { TimeWindow } from '../rules/dashboard/visualization/RulesDashboardInsights';

gql`
  query TotalPendingJobs {
    getTotalPendingJobsCount
  }

  query RuleNamesAndIds {
    myOrg {
      rules {
        id
        name
      }
    }
  }
`;

// If there are decimals present, round to the nearest 10th, unless it's less
// than 1, in which case round to the nearest 100th.
function formatNumber(n: number) {
  if (n === 0) {
    return '0';
  }
  if (Math.abs(n) < 1) {
    return n.toFixed(2).toLocaleString();
  }
  return (n % 1 === 0 ? n : n.toFixed(1)).toLocaleString();
}

// Gets a time window of the same duration as the given one, but with its end
// date as the same value as the input's start date.
function getPreviousTimeWindow(timeWindow: TimeWindow): TimeWindow {
  return {
    start: subMilliseconds(
      timeWindow.start,
      differenceInMilliseconds(timeWindow.end, timeWindow.start),
    ),
    end: timeWindow.start,
  };
}

export default function OverviewCard(props: {
  title: string;
  icon: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
  iconColor: 'text-teal-300' | 'text-orange-400' | 'text-amber-400';
  timeWindow: TimeWindow;
  statistic:
    | 'TOTAL_ACTIONS'
    | 'JOBS_PENDING'
    | 'VIOLATIONS_PER_POLICY'
    | 'MATCHES_PER_RULE'
    | 'AUTOMATED_VS_MANUAL';
  hidePercentChange?: boolean;
}) {
  const {
    title,
    icon: Icon,
    iconColor,
    timeWindow,
    statistic,
    hidePercentChange = false,
  } = props;

  const previousTimeWindow = useMemo(
    () => getPreviousTimeWindow(timeWindow),
    [timeWindow],
  );

  const [
    getTotalActionsData,
    {
      data: totalActionsData,
      loading: totalActionsLoading,
      error: totalActionsError,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        groupBy: 'ACTION_ID',
        filterBy: {
          actionIds: [],
          policyIds: [],
          ruleIds: [],
          itemTypeIds: [],
          sources: [],
          startDate: timeWindow.start,
          endDate: timeWindow.end,
        },
        timeDivision: 'DAY',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  const [
    getPreviousTotalActionsData,
    {
      data: previousTotalActionsData,
      loading: previousTotalActionsLoading,
      error: previousTotalActionsError,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        groupBy: 'ACTION_ID',
        filterBy: {
          actionIds: [],
          policyIds: [],
          ruleIds: [],
          itemTypeIds: [],
          sources: [],
          startDate: previousTimeWindow.start,
          endDate: previousTimeWindow.end,
        },
        timeDivision: 'DAY',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  const [
    getTotalActionsByRuleData,
    {
      data: totalActionsByRuleData,
      loading: totalActionsByRuleLoading,
      error: totalActionsByRuleError,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        groupBy: 'RULE_ID', // This will help with the MATCHES_PER_RULE statistic
        filterBy: {
          actionIds: [],
          policyIds: [],
          ruleIds: [],
          itemTypeIds: [],
          sources: [],
          startDate: timeWindow.start,
          endDate: timeWindow.end,
        },
        timeDivision: 'DAY',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });

  const [
    getTotalPendingJobsData,
    {
      data: jobsPendingData,
      loading: jobsPendingLoading,
      error: jobsPendingError,
    },
  ] = useGQLTotalPendingJobsLazyQuery();

  const [
    getViolationsPerPolicyData,
    {
      data: violationsPerPolicyData,
      loading: violationsPerPolicyLoading,
      error: violationsPerPolicyError,
    },
  ] = useGQLViolationsPerPolicyLazyQuery({
    variables: {
      input: {
        filterBy: {
          startDate: timeWindow.start,
          endDate: timeWindow.end,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });

  const [
    getAutomatedVsManualData,
    {
      data: automatedVsManualData,
      loading: automatedVsManualLoading,
      error: automatedVsManualError,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        groupBy: 'ACTION_SOURCE',
        filterBy: {
          actionIds: [],
          policyIds: [],
          ruleIds: [],
          itemTypeIds: [],
          sources: [],
          startDate: timeWindow.start,
          endDate: timeWindow.end,
        },
        timeDivision: 'DAY',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });
  const [
    getPreviousAutomatedVsManualData,
    {
      data: previousAutomatedVsManualData,
      loading: previousAutomatedVsManualLoading,
      error: previousAutomatedVsManualError,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        groupBy: 'ACTION_SOURCE',
        filterBy: {
          actionIds: [],
          policyIds: [],
          ruleIds: [],
          itemTypeIds: [],
          sources: [],
          startDate: previousTimeWindow.start,
          endDate: previousTimeWindow.end,
        },
        timeDivision: 'DAY',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });

  const [
    getPoliciesInfo,
    { data: policiesData, loading: policiesLoading, error: policiesError },
  ] = useGQLPolicyRollupDataLazyQuery();
  const [
    getRulesInfo,
    { data: rulesData, loading: rulesLoading, error: rulesError },
  ] = useGQLRuleNamesAndIdsLazyQuery();

  useEffect(() => {
    switch (statistic) {
      case 'TOTAL_ACTIONS':
        getTotalActionsData();
        getPreviousTotalActionsData();
        break;
      case 'MATCHES_PER_RULE':
        getTotalActionsByRuleData();
        getRulesInfo();
        break;
      case 'JOBS_PENDING':
        getTotalPendingJobsData();
        break;
      case 'VIOLATIONS_PER_POLICY':
        getViolationsPerPolicyData();
        getPoliciesInfo();
        break;
      case 'AUTOMATED_VS_MANUAL':
        getAutomatedVsManualData();
        getPreviousAutomatedVsManualData();
        break;
      default:
        assertUnreachable(statistic);
    }
  }, [
    getAutomatedVsManualData,
    getTotalActionsData,
    getTotalPendingJobsData,
    getViolationsPerPolicyData,
    getPoliciesInfo,
    getRulesInfo,
    statistic,
    timeWindow,
    getPreviousTotalActionsData,
    getPreviousAutomatedVsManualData,
    getTotalActionsByRuleData,
  ]);

  const totalActions = totalActionsData?.actionStatistics
    ? sum(totalActionsData?.actionStatistics.map((it) => it.count))
    : undefined;

  const previousTotalActions = previousTotalActionsData?.actionStatistics
    ? sum(previousTotalActionsData?.actionStatistics.map((it) => it.count))
    : undefined;

  const jobsPending = jobsPendingData?.getTotalPendingJobsCount;

  const matchesPerRule = totalActionsByRuleData?.actionStatistics
    ? Object.entries(
        groupBy(totalActionsByRuleData?.actionStatistics, 'rule_id'),
      )
        .map(([ruleId, counts]) => ({
          name:
            rulesData?.myOrg?.rules.find((it) => it.id === ruleId)?.name ??
            'Unknown',
          count: sum(counts.map((it) => it.count)),
          link: `/dashboard/rules/proactive/info/${ruleId}`,
        }))
        .sort((a, b) => b.count - a.count)
    : undefined;

  const violationsPerPolicy = violationsPerPolicyData?.topPolicyViolations
    ? violationsPerPolicyData?.topPolicyViolations
        .map((it) => ({
          name:
            policiesData?.myOrg?.policies.find((p) => p.id === it.policyId)
              ?.name ?? 'Unknown',
          count: it.count,
        }))
        .sort((a, b) => b.count - a.count)
    : undefined;

  const [automatedActions, manualActions] =
    automatedVsManualData?.actionStatistics
      ? partition(
          automatedVsManualData?.actionStatistics,
          (it) =>
            it.source &&
            [
              'automated-rule',
              'post-actions',
              'user-strike-action-execution',
            ].includes(it.source),
        )
      : [undefined, undefined];
  const [previousAutomatedActions, previousManualActions] =
    previousAutomatedVsManualData?.actionStatistics
      ? partition(
          previousAutomatedVsManualData?.actionStatistics,
          (it) =>
            it.source &&
            [
              'automated-rule',
              'post-actions',
              'user-strike-action-execution',
            ].includes(it.source),
        )
      : [undefined, undefined];
  const automatedActionCount = automatedActions
    ? sum(automatedActions.map((it) => it.count))
    : undefined;
  const manualActionCount = manualActions
    ? sum(manualActions.map((it) => it.count))
    : undefined;
  const previousAutomatedActionCount = previousAutomatedActions
    ? sum(previousAutomatedActions.map((it) => it.count))
    : undefined;
  const previousManualActionCount = previousManualActions
    ? sum(previousManualActions.map((it) => it.count))
    : undefined;

  if (
    totalActionsError ||
    previousTotalActionsError ||
    jobsPendingError ||
    violationsPerPolicyError ||
    automatedVsManualError ||
    previousAutomatedVsManualError ||
    policiesError ||
    rulesError ||
    totalActionsByRuleError
  ) {
    throw (
      totalActionsError ??
      previousTotalActionsError ??
      jobsPendingError ??
      violationsPerPolicyError ??
      automatedVsManualError ??
      previousAutomatedVsManualError ??
      policiesError ??
      rulesError ??
      // eslint-disable-next-line
      totalActionsByRuleError!
    );
  }

  const loading =
    totalActionsLoading ||
    previousTotalActionsLoading ||
    jobsPendingLoading ||
    violationsPerPolicyLoading ||
    automatedVsManualLoading ||
    previousAutomatedVsManualLoading ||
    policiesLoading ||
    totalActionsByRuleLoading ||
    rulesLoading;

  const [singleNumberStatistic, previousSingleNumberStatistic] = useMemo(
    () =>
      totalActions !== undefined && statistic === 'TOTAL_ACTIONS'
        ? [totalActions, previousTotalActions]
        : jobsPending !== undefined && statistic === 'JOBS_PENDING'
          ? [jobsPending, undefined]
          : [undefined, undefined],
    [jobsPending, previousTotalActions, statistic, totalActions],
  );

  const percentChangeComponent = (opts: { change: number }) => {
    const { change } = opts;
    if (isNaN(change) || change === Infinity) {
      return <div />;
    }
    return (
      <div className="flex items-center gap-2">
        <div
          className={`${
            change === 0
              ? 'text-slate-600'
              : change < 0
                ? 'text-red-600'
                : 'text-green-600'
          } p-1 gap-1 rounded text-sm font-semibold flex items-center`}
        >
          {change === 0 ? (
            <ArrowsHorizontal className="w-3 h-3" />
          ) : change < 0 ? (
            <ChevronDownFilled className="w-2 h-2" />
          ) : (
            <ChevronUpFilled className="w-2 h-2" />
          )}
          {formatNumber(Math.abs(change))}%
        </div>
        <div className="text-sm font-normal text-slate-400">
          vs. previous {formatDistance(timeWindow.end, timeWindow.start)}
        </div>
      </div>
    );
  };

  const singleStatisticComponent = (opts: {
    num: number;
    previousNum?: number;
  }) => {
    const { num, previousNum } = opts;
    return (
      <div className="flex flex-col gap-3 pt-4 text-3xl font-semibold text-slate-900">
        {formatNumber(num)}
        {hidePercentChange
          ? null
          : percentChangeComponent({
              change: previousNum
                ? ((num - previousNum) / previousNum) * 100
                : 0,
            })}
      </div>
    );
  };

  const percentProgressComponent = (opts: {
    num: number;
    total: number;
    previousNum?: number;
    previousTotal?: number;
  }) => {
    const { num, total, previousNum, previousTotal } = opts;
    const percent = (num / total) * 100;
    const previousPercent =
      previousNum && previousTotal ? (previousNum / previousTotal) * 100 : 0;
    return (
      <div className="flex flex-col gap-3 pt-4 font-semibold text-slate-900">
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-2 text-lg">
            {formatNumber(percent)}%{' '}
            <div className="text-base font-normal text-slate-400">
              automated
            </div>
          </div>
          <div className="flex gap-0 w-[200px]">
            <div
              className="h-2 rounded-l-full bg-primary"
              style={{
                width: `${(num / total) * 200}px`,
              }}
            />
            <div
              className="h-2 bg-gray-200 rounded-r-full"
              style={{
                width: `${200 - (num / total) * 200}px`,
              }}
            />
          </div>
        </div>
        {percentChangeComponent({
          change: ((percent - previousPercent) / previousPercent) * 100,
        })}
      </div>
    );
  };

  const orderedListComponent = (
    list: ({ name: string } & ({ link: string } | { count: number }))[],
  ) => (
    <div className="flex flex-col w-full gap-1 pt-3 text-3xl font-semibold text-slate-900">
      {list.slice(0, 3).map((value) => (
        <div
          className="flex justify-between w-full text-sm font-normal"
          key={value.name}
        >
          <div className="text-slate-700">{value.name}</div>
          {'link' in value ? (
            <Link
              className="no-underline flex items-center gap-1.5 hover:text-primary/70"
              href={value.link}
              target="_blank"
            >
              View
              <ArrowRight className="w-3 h-3 fill-primary hover:fill-primary" />
            </Link>
          ) : (
            <div className="text-primary">{formatNumber(value.count)}</div>
          )}
        </div>
      ))}
    </div>
  );

  const errorComponent = (
    <div className="py-4 text-coop-alert-red">Error finding value</div>
  );

  const component = useMemo(() => {
    switch (statistic) {
      case 'TOTAL_ACTIONS':
      case 'JOBS_PENDING':
        return singleNumberStatistic !== undefined
          ? singleStatisticComponent({
              num: singleNumberStatistic,
              previousNum: previousSingleNumberStatistic,
            })
          : errorComponent;
      case 'MATCHES_PER_RULE':
        return matchesPerRule
          ? orderedListComponent(matchesPerRule)
          : errorComponent;
      case 'VIOLATIONS_PER_POLICY':
        return violationsPerPolicy
          ? orderedListComponent(violationsPerPolicy)
          : errorComponent;
      case 'AUTOMATED_VS_MANUAL':
        return automatedActionCount !== undefined &&
          manualActionCount !== undefined
          ? percentProgressComponent({
              num: automatedActionCount,
              total: automatedActionCount + manualActionCount,
              previousNum: previousAutomatedActionCount,
              previousTotal:
                previousAutomatedActionCount && previousManualActionCount
                  ? previousAutomatedActionCount + previousManualActionCount
                  : undefined,
            })
          : errorComponent;
      default:
        assertUnreachable(statistic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    automatedActionCount,
    manualActionCount,
    matchesPerRule,
    previousSingleNumberStatistic,
    previousAutomatedActionCount,
    previousManualActionCount,
    singleNumberStatistic,
    statistic,
    violationsPerPolicy,
  ]);

  return (
    <div className="flex justify-between p-4 bg-white border border-solid rounded-lg border-slate-200 grow">
      <div className="flex flex-col w-full text-start">
        <div className="flex justify-between w-full">
          <div className="text-base font-bold">{title}</div>
          <Icon className={`flex w-6 h-6 ${iconColor}`} />
        </div>
        {loading ? (
          <div className="self-start pt-4">
            <ComponentLoading />
          </div>
        ) : (
          component
        )}
      </div>
    </div>
  );
}
