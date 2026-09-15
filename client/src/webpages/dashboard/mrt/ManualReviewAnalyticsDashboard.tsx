import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import ManualReviewCustomCharts from '@/webpages/dashboard/mrt/visualization/ManualReviewCustomCharts';
import ManualReviewDefaultCharts from '@/webpages/dashboard/mrt/visualization/ManualReviewDefaultCharts';
import { gql } from '@apollo/client';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import sum from 'lodash/sum';
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';

import DashboardHeader from '../components/DashboardHeader';
import TabBar from '../components/TabBar';

import {
  useGQLGetAverageHandleTimeSummaryQuery,
  useGQLGetAverageTimeToReviewQuery,
  useGQLManualReviewMetricsQuery,
} from '../../../graphql/generated';
import { TimeWindow } from '../rules/dashboard/visualization/RulesDashboardInsights';
import {
  filterCountsInTimeWindow,
  getPreviousInclusiveTimeWindow,
} from './mrtAnalyticsUtils';

type ManualReviewAnalyticsDashboardTab = 'home' | 'custom';

gql`
  query ManualReviewMetrics {
    getTotalPendingJobsCount
    reportingInsights {
      totalIngestedReportsByDay {
        date
        count
      }
    }
  }
  query getAverageTimeToReview($input: TimeToActionInput!) {
    getTimeToAction(input: $input) {
      timeToAction
      queueId
    }
  }
  query getAverageHandleTimeSummary($input: HandleTimeInput!) {
    getHandleTime(input: $input) {
      handleTimeSeconds
      reviewerId
      queueId
    }
  }
`;

export default function ManualReviewAnalyticsDashboard() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const today = new Date();
    return {
      start: startOfDay(subDays(today, 6)),
      end: endOfDay(today),
    };
  });

  const [activeTab, setActiveTab] =
    useState<ManualReviewAnalyticsDashboardTab>('home');

  const { loading, data } = useGQLManualReviewMetricsQuery();

  const previousTimeWindow = useMemo(
    () => getPreviousInclusiveTimeWindow(timeWindow),
    [timeWindow],
  );

  const getTotalIngestedReportsInTimeWindow = (window: TimeWindow) => {
    const ingestedReportsInWindow = filterCountsInTimeWindow(
      data?.reportingInsights.totalIngestedReportsByDay,
      window,
    );
    return ingestedReportsInWindow
      ? sum(ingestedReportsInWindow.map((it) => it.count))
      : undefined;
  };

  const totalIngestedReportsInTimeWindow =
    getTotalIngestedReportsInTimeWindow(timeWindow);
  const totalIngestedReportsInPreviousWindow =
    getTotalIngestedReportsInTimeWindow(previousTimeWindow);

  const { loading: timeToActionLoading, data: timeToActionData } =
    useGQLGetAverageTimeToReviewQuery({
      variables: {
        input: {
          groupBy: [],
          filterBy: {
            startDate: timeWindow.start,
            endDate: timeWindow.end,
            itemTypeIds: [],
            queueIds: [],
          },
        },
      },
    });
  const {
    loading: previousTimeToActionLoading,
    data: previousTimeToActionData,
  } = useGQLGetAverageTimeToReviewQuery({
    variables: {
      input: {
        groupBy: [],
        filterBy: {
          startDate: previousTimeWindow.start,
          endDate: previousTimeWindow.end,
          itemTypeIds: [],
          queueIds: [],
        },
      },
    },
  });

  const currentPeriodTimeToAction =
    timeToActionData?.getTimeToAction?.[0].timeToAction ?? 0;
  const previousPeriodTimeToAction =
    previousTimeToActionData?.getTimeToAction?.[0].timeToAction ?? 0;

  const {
    loading: handleTimeLoading,
    data: handleTimeData,
    error: handleTimeError,
  } = useGQLGetAverageHandleTimeSummaryQuery({
    variables: {
      input: {
        groupBy: [],
        filterBy: {
          startDate: timeWindow.start,
          endDate: timeWindow.end,
          queueIds: [],
          reviewerIds: [],
        },
      },
    },
  });
  const {
    loading: previousHandleTimeLoading,
    data: previousHandleTimeData,
    error: previousHandleTimeError,
  } = useGQLGetAverageHandleTimeSummaryQuery({
    variables: {
      input: {
        groupBy: [],
        filterBy: {
          startDate: previousTimeWindow.start,
          endDate: previousTimeWindow.end,
          queueIds: [],
          reviewerIds: [],
        },
      },
    },
  });

  const currentPeriodHandleTime =
    handleTimeData?.getHandleTime?.[0]?.handleTimeSeconds ?? undefined;
  const previousPeriodHandleTime =
    previousHandleTimeData?.getHandleTime?.[0]?.handleTimeSeconds ?? undefined;
  const handleTimeQueryFailed =
    handleTimeError != null || previousHandleTimeError != null;

  return (
    <div>
      <Helmet>
        <title>Manual Review Analytics</title>
      </Helmet>
      <DashboardHeader
        title="Manual Review Analytics"
        subtitle="Track user reports and monitor your moderators' decisions."
        rightComponent={
          <div className="flex items-center gap-4">
            <div className="font-semibold text-slate-500">Date Range</div>
            <DateRangePicker
              initialDateFrom={timeWindow.start}
              initialDateTo={timeWindow.end}
              onUpdate={({ range }) => {
                setTimeWindow({
                  start: range.from,
                  end: range.to ?? range.from,
                });
              }}
              align="end"
            />
          </div>
        }
      />
      <TabBar<ManualReviewAnalyticsDashboardTab>
        tabs={[
          { label: 'Home', value: 'home' },
          { label: 'My Custom Dashboard', value: 'custom' },
        ]}
        initialSelectedTab={'home'}
        onTabClick={setActiveTab}
      />
      {activeTab === 'home' ? (
        <ManualReviewDefaultCharts
          timeWindow={timeWindow}
          loading={
            loading ||
            timeToActionLoading ||
            previousTimeToActionLoading ||
            handleTimeLoading ||
            previousHandleTimeLoading
          }
          averageTimeToReviewInWindow={currentPeriodTimeToAction ?? 0}
          averageTimeToReviewInPreviousWindow={previousPeriodTimeToAction ?? 0}
          averageHandleTimeInWindow={
            handleTimeQueryFailed ? undefined : currentPeriodHandleTime
          }
          averageHandleTimeInPreviousWindow={
            handleTimeQueryFailed ? undefined : previousPeriodHandleTime
          }
          handleTimeError={handleTimeQueryFailed}
          totalIngestedReportsInWindow={totalIngestedReportsInTimeWindow}
          totalIngestedReportsInPreviousWindow={
            totalIngestedReportsInPreviousWindow
          }
          currentlyOpenJobs={data?.getTotalPendingJobsCount ?? 0}
        />
      ) : (
        <ManualReviewCustomCharts timeWindow={timeWindow} />
      )}
    </div>
  );
}
