import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { useGQLDashboardOrgQuery } from '@/graphql/generated';
import {
  FileExclamationFilled,
  FlowChartAltFilled,
  PieChartAlt1Filled,
  TapFilled,
  UsersFilled,
} from '@/icons';
import { LookbackLength } from '@/utils/time';
import { makeEnumLike } from '@roostorg/types';
import { startOfHour, subDays } from 'date-fns';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import DashboardHeader from '../components/DashboardHeader';
import FullScreenLoading from '@/components/common/FullScreenLoading';

import { ChartType } from '../rules/dashboard/visualization/RulesDashboardInsights';
import RuleDashboardInsightsChart from '../rules/dashboard/visualization/rulesDashboardInsightsChart';
import OverviewCard from './OverviewCard';
import OverviewChart from './OverviewChart';
import OverviewTable from './OverviewTable';

export const TimeDivisionOption = makeEnumLike(['HOUR', 'DAY'] as const);
export type TimeDivisionOptions = keyof typeof TimeDivisionOption;
export function getDisplayNameForTimeDivision(
  timeDivision: TimeDivisionOptions,
) {
  switch (timeDivision) {
    case 'HOUR':
      return 'Hourly breakdown';
    case 'DAY':
      return 'Daily breakdown';
  }
}

export default function Overview() {
  const { loading, error } = useGQLDashboardOrgQuery();
  const [timeDivision, setTimeDivision] = useState<TimeDivisionOptions>('DAY');
  const [customTimeWindow, setCustomTimeWindow] = useState({
    start: startOfHour(subDays(new Date(), 7)),
    end: startOfHour(new Date()),
  });
  if (error) {
    throw error;
  }

  const totalActionsTakenCard = (
    <OverviewCard
      key="total-actions"
      title="Actions taken"
      icon={TapFilled}
      iconColor="text-teal-300"
      timeWindow={customTimeWindow}
      statistic="TOTAL_ACTIONS"
    />
  );

  const jobsPendingReviewCard = (
    <OverviewCard
      key="jobs-pending"
      title="Jobs pending review"
      icon={UsersFilled}
      iconColor="text-orange-400"
      timeWindow={customTimeWindow}
      hidePercentChange={true}
      statistic="JOBS_PENDING"
    />
  );

  const topPolicyViolationsCard = (
    <OverviewCard
      key="violations-per-policy"
      title="Top policy violations"
      icon={FileExclamationFilled}
      iconColor="text-amber-400"
      timeWindow={customTimeWindow}
      statistic="VIOLATIONS_PER_POLICY"
    />
  );

  const automatedVsManualActionsCard = (
    <OverviewCard
      key="automated-vs-manual"
      title="Automated vs. manual actions"
      icon={PieChartAlt1Filled}
      iconColor="text-amber-400"
      timeWindow={customTimeWindow}
      statistic="AUTOMATED_VS_MANUAL"
    />
  );

  const cards = [
    totalActionsTakenCard,
    jobsPendingReviewCard,
    automatedVsManualActionsCard,
    topPolicyViolationsCard,
  ];

  const decisionsPerModeratorChart = (
    <OverviewChart
      key="decisions"
      title="Decisions per moderator"
      icon={UsersFilled}
      iconColor="text-orange-400"
      metric="Decisions"
      timeDivision={timeDivision}
      timeWindow={customTimeWindow}
      chartType={ChartType.BAR}
    />
  );

  const actionsPerRuleChart = (chartType: ChartType.BAR | ChartType.LINE) => (
    <OverviewChart
      key="actions"
      title="Actions per rule"
      icon={FlowChartAltFilled}
      iconColor="text-amber-400"
      metric="Actions"
      timeDivision={timeDivision}
      timeWindow={customTimeWindow}
      chartType={chartType}
    />
  );

  const topViolationsByPolicyTable = (
    <OverviewTable
      key="policy"
      title="Policy Violations"
      icon={FileExclamationFilled}
      iconColor="text-amber-400"
      groupBy="policy"
      timeWindow={customTimeWindow}
    />
  );

  const charts = [
    decisionsPerModeratorChart,
    actionsPerRuleChart(ChartType.LINE),
    topViolationsByPolicyTable,
  ];

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Overview</title>
      </Helmet>
      <DashboardHeader
        title="Overview"
        rightComponent={
          <div className="flex gap-3">
            <Select
              onValueChange={(value) =>
                setTimeDivision(value as TimeDivisionOptions)
              }
              value={timeDivision}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(TimeDivisionOption).map((val) => (
                    <SelectItem value={val} key={val}>
                      {getDisplayNameForTimeDivision(val)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <DateRangePicker
              initialDateFrom={customTimeWindow.start}
              initialDateTo={customTimeWindow.end}
              onUpdate={({ range }) => {
                setCustomTimeWindow({
                  start: range.from,
                  end: range.to ?? range.from,
                });
              }}
              align="end"
              isSingleMonthOnly
            />
          </div>
        }
      />
      {loading ? (
        <FullScreenLoading />
      ) : (
        <div className="flex flex-col w-full gap-4 mb-12">
          <div className="flex flex-col w-full gap-4 sm:flex-row">{cards}</div>
          <div className="flex w-full">
            <RuleDashboardInsightsChart
              lookback={LookbackLength.CUSTOM}
              timeWindow={customTimeWindow}
              timeDivision={timeDivision}
              title="Total actions"
              initialGroupBy="ACTION_ID"
            />
          </div>
          <div className="flex w-full gap-4">{charts}</div>
        </div>
      )}
    </div>
  );
}
