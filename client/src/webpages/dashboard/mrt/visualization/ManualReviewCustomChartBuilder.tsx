import { DeleteOutlined } from '@ant-design/icons';
import { Input, Radio } from 'antd';

import { GQLManualReviewChartMetric } from '../../../../graphql/generated';
import {
  ChartType,
  TimeWindow,
} from '../../rules/dashboard/visualization/RulesDashboardInsights';
import { ManualReviewCustomChartConfig } from './ManualReviewCustomCharts';
import ManualReviewDashboardInsightsChart from './ManualReviewDashboardInsightsChart';

interface ManualReviewCustomChartBuilderProps {
  timeWindow: TimeWindow;
  chart: ManualReviewCustomChartConfig;
  updateChart: (chart: ManualReviewCustomChartConfig) => void;
  deleteChart: (chart: ManualReviewCustomChartConfig) => void;
}

const ManualReviewCustomChartBuilder = ({
  timeWindow,
  chart,
  updateChart,
  deleteChart,
}: ManualReviewCustomChartBuilderProps) => (
  <div className="flex flex-col rounded border border-solid border-slate-200 bg-white w-full h-full min-h-[400px]">
    <div className="flex flex-col p-6 gap-4">
      <div className="flex items-center">
        <Input
          className="px-4 py-2 text-base rounded"
          placeholder="Choose a title"
          onChange={(e) => {
            updateChart({
              ...chart,
              title: e.target.value,
            });
          }}
          value={chart.title}
        />
        <div
          className="flex items-center justify-center p-1 text-white rounded cursor-pointer gap-2 bg-coop-alert-red hover:bg-coop-alert-red-hover h-fit whitespace-nowrap"
          onClick={() => deleteChart(chart)}
        >
          <DeleteOutlined className="flex items-center justify-center rounded-full" />{' '}
          Delete Chart
        </div>
      </div>
      <div className="flex items-center">
        <div className="pr-3 font-medium text-slate-500">Select a metric:</div>
        <Radio.Group
          className="flex items-center justify-end"
          onChange={(event) =>
            updateChart({
              ...chart,
              metric: event.target.value,
            })
          }
          value={chart.metric}
        >
          <Radio value={GQLManualReviewChartMetric.Decisions}>Decisions</Radio>
          <Radio value={GQLManualReviewChartMetric.Jobs}>Jobs</Radio>
        </Radio.Group>
      </div>
    </div>
    <div className="flex h-px mx-6 bg-slate-200" />
    {chart.metric != null ? (
      <ManualReviewDashboardInsightsChart
        timeWindow={timeWindow}
        initialChartType={ChartType.LINE}
        initialGroupBy={undefined}
        metric={chart.metric}
        hideTotal
        hideChartSelection
        hideBorder
        hideOptions
        onSelectGroupBy={(groupBy) => updateChart({ ...chart, groupBy })}
        onUpdateFilterBy={(filterBy) => updateChart({ ...chart, filterBy })}
        onSelectTimeDivision={(timeDivision) =>
          updateChart({ ...chart, timeDivision })
        }
      />
    ) : null}
  </div>
);
export default ManualReviewCustomChartBuilder;
