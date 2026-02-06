import {
  AreaChartOutlined,
  FlagOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

import {
  ChartType,
  TimeWindow,
} from '../../rules/dashboard/visualization/RulesDashboardInsights';
import ManualReviewDecisionsTable from '../ManualReviewDecisionsTable';
import ManualReviewDashboardInsightsCard from './ManualReviewDashboardInsightsCard';
import ManualReviewDashboardInsightsChart from './ManualReviewDashboardInsightsChart';
import TimeToActionByQueueChart from './TimeToActionChart';

interface ManualReviewDefaultChartsProps {
  timeWindow: TimeWindow;
  loading: boolean;
  totalIngestedReportsInWindow: number | undefined;
  totalIngestedReportsInPreviousWindow: number | undefined;
  averageTimeToReviewInWindow: number | undefined;
  averageTimeToReviewInPreviousWindow: number | undefined;
  currentlyOpenJobs: number;
}

export default function ManualReviewDefaultCharts({
  timeWindow,
  loading,
  totalIngestedReportsInWindow,
  totalIngestedReportsInPreviousWindow,
  averageTimeToReviewInWindow,
  averageTimeToReviewInPreviousWindow,
  currentlyOpenJobs,
}: ManualReviewDefaultChartsProps) {
  const getPercentChange = (oldValue: number, newValue: number) => {
    if (oldValue === 0) {
      return newValue === 0 ? 0 : Infinity;
    }

    return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  };

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex gap-4">
        <ManualReviewDashboardInsightsCard
          title="Jobs Created"
          value={totalIngestedReportsInWindow}
          change={
            totalIngestedReportsInPreviousWindow != null &&
            totalIngestedReportsInWindow != null
              ? getPercentChange(
                  totalIngestedReportsInPreviousWindow,
                  totalIngestedReportsInWindow,
                )
              : undefined
          }
          timeWindow={timeWindow}
          icon={
            <AreaChartOutlined className="flex p-2 text-lg rounded-lg bg-coop-lightpurple text-coop-purple" />
          }
          loading={loading}
        />
        <ManualReviewDashboardInsightsCard
          title="Currently Open Jobs"
          value={currentlyOpenJobs}
          timeWindow={timeWindow}
          icon={
            <FlagOutlined className="flex p-2 text-lg rounded-lg bg-coop-lightred text-coop-red" />
          }
          loading={loading}
          link={'/dashboard/manual_review/queues'}
          linkTitle={'Go to Queues'}
        />
        <ManualReviewDashboardInsightsCard
          title="Average Hours Until Review"
          value={
            averageTimeToReviewInWindow
              ? Number((averageTimeToReviewInWindow / 60 / 60).toFixed(2))
              : 0
          }
          change={
            averageTimeToReviewInPreviousWindow != null &&
            averageTimeToReviewInWindow != null
              ? getPercentChange(
                  averageTimeToReviewInPreviousWindow,
                  averageTimeToReviewInWindow,
                )
              : undefined
          }
          timeWindow={timeWindow}
          icon={
            <HistoryOutlined className="flex p-2 text-lg rounded-lg bg-coop-lightorange text-coop-orange" />
          }
          loading={loading}
        />
      </div>
      <ManualReviewDashboardInsightsChart
        timeWindow={timeWindow}
        initialChartType={ChartType.LINE}
        metric="DECISIONS"
        initialGroupBy={['TYPE']}
        title="All Decisions"
      />
      <div className="grid grid-cols-1 gap-4 py-4 xl:grid-cols-2">
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="DECISIONS"
          initialGroupBy={['POLICY_ID']}
          title="Decisions by Policy"
          hideGroupBy
          hideFilterBy
          hideTotal
          narrowMode
          infoText="This chart shows all moderator decisions per policy."
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="JOBS"
          initialGroupBy={['QUEUE_ID']}
          title="Jobs by Queue"
          hideGroupBy
          hideFilterBy
          hideTotal
          narrowMode
          infoText="This chart shows the number of manual review jobs that ended up in each queue."
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="DECISIONS"
          initialGroupBy={['REVIEWER_ID']}
          title="Decisions by Moderator"
          hideGroupBy
          hideTotal
          narrowMode
          infoText="This chart shows all moderator decisions per moderator."
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="JOBS"
          initialGroupBy={['SOURCE']}
          title="Jobs by Source"
          hideGroupBy
          hideFilterBy
          hideTotal
          narrowMode
          infoText={`This chart shows the number of manual review jobs that
           Coop received, split by the source of those jobs. The possible sources
           are (1) "User Report", which indicates that a user on your platform reported
           the content in the job, (2) "Rule", which indicates that one of your Coop
           Rules automatically created the job, and (3) "Moderator", which indicates that
           a moderator added this job to a queue while reviewing a different job.`}
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="REVIEWED_JOBS"
          initialGroupBy={['REVIEWER_ID']}
          title="Reviewed Jobs By Moderator"
          hideGroupBy
          hideTotal
          narrowMode
          infoText="This chart shows all reviewed jobs per moderator."
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="REVIEWED_JOBS"
          initialGroupBy={['QUEUE_ID']}
          title="Reviewed Jobs By Queue"
          hideGroupBy
          hideTotal
          narrowMode
          infoText="This chart shows all reviewed jobs per queue."
        />
        <ManualReviewDashboardInsightsChart
          timeWindow={timeWindow}
          initialChartType={ChartType.LINE}
          metric="SKIPPED_JOBS"
          initialGroupBy={['REVIEWER_ID']}
          title="Skipped Jobs By Queue"
          hideGroupBy
          hideTotal
          narrowMode
          infoText="This chart shows all jobs skipped by reviewers per queue."
        />
        <TimeToActionByQueueChart
          timeWindow={timeWindow}
          title="Average Time To Review By Queue"
          hideGroupBy
          hideTotal
          narrowMode
          infoText="This chart shows all reviewed jobs per queue."
        />
      </div>
      <ManualReviewDecisionsTable timeWindow={timeWindow} />
    </div>
  );
}
