import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import { InvestmentFilled } from '@/icons';
import { BarChartOutlined, LineChartOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import last from 'lodash/last';
import orderBy from 'lodash/orderBy';
import sortBy from 'lodash/sortBy';
import sumBy from 'lodash/sumBy';
import moment from 'moment';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';

import ComponentLoading from '../../../../../components/common/ComponentLoading';

import {
  GQLReportingRulePassRateAnalyticsQuery,
  useGQLReportingRulePassRateAnalyticsQuery,
} from '../../../../../graphql/generated';
import { filterNullOrUndefined } from '../../../../../utils/collections';
import { safePick } from '../../../../../utils/misc';
import { WEEK } from '../../../../../utils/time';
import { PRIMARY_COLOR } from '../../dashboard/visualization/chartColors';
import {
  ChartType,
  TimeWindow,
} from '../../dashboard/visualization/RulesDashboardInsights';
import RulesDashboardInsightsStats from '../../dashboard/visualization/RulesDashboardInsightsStats';
import RuleInsightsEmptyCard from './RuleInsightsEmptyCard';

gql`
  query ReportingRulePassRateAnalytics($id: ID!) {
    rule(id: $id) {
      insights {
        passRateData {
          date
          totalMatches
          totalRequests
        }
      }
    }
  }
`;

export default function ReportingRuleInsightsActionsChart(props: {
  ruleId: string;
}) {
  const { ruleId } = props;
  const { loading, error, data } = useGQLReportingRulePassRateAnalyticsQuery({
    variables: { id: ruleId },
  });

  const [timeWindow, setTimeWindow] = useState<TimeWindow>({
    start: new Date(Date.now() - WEEK),
    end: new Date(),
  });

  const [chartType, setChartType] = useState(ChartType.LINE);

  const passRateData = data?.rule?.insights.passRateData ?? undefined;

  const getDataInTimeWindow = useCallback(
    (
      arr?: NonNullable<
        NonNullable<GQLReportingRulePassRateAnalyticsQuery['rule']>['insights']
      >['passRateData'],
    ) =>
      filterNullOrUndefined(arr ?? []).filter((elemWithDate) => {
        const time = new Date(elemWithDate.date).getTime();
        return (
          time > timeWindow.start.getTime() && time < timeWindow.end.getTime()
        );
      }),
    [timeWindow],
  );

  const filteredPassRateData = useMemo(
    () => getDataInTimeWindow(passRateData),
    [passRateData, getDataInTimeWindow],
  );

  const totalActionedSubmissionsInTimeWindow = useMemo(
    () => sumBy(filteredPassRateData, 'totalMatches'),
    [filteredPassRateData],
  );

  const chartData = useMemo(() => {
    if (!filteredPassRateData) {
      return null;
    }

    if (!filteredPassRateData.length) {
      return [];
    }

    return filteredPassRateData
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((actionData) => {
        // change actionData.date format from YYYY-MM-DD to MM/DD
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [year, month, date] = actionData.date.split('-');

        return {
          date: `${month}/${date}/${year.slice(-2)}`,
          totalMatches: actionData.totalMatches,
          totalRequests: actionData.totalRequests,
        };
      });
  }, [filteredPassRateData]);

  const renderCustomXAxisTick = ({ x, y, payload }: any) => {
    return (
      <text
        x={x - 24}
        y={y + 16}
        fill="#71717a"
        className="pt-3 text-slate-500"
      >
        {payload.value}
      </text>
    );
  };

  const renderCustomYAxisTick = ({ x, y, payload }: any) => (
    <text
      textAnchor="end"
      x={x - 12}
      y={y + 4}
      fill="#71717a"
      className="pr-3 text-slate-500"
    >
      {payload.value}
    </text>
  );

  const renderDot = (props: any) => {
    const { cx, cy, stroke } = props;
    return (
      <circle
        style={{ zIndex: 10 }}
        cx={cx}
        cy={cy}
        r={4}
        stroke={stroke}
        strokeWidth={4}
        fill="white"
        fillOpacity={1.0}
      />
    );
  };

  const customTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = orderBy(
        payload
          .filter((it) => it.type !== 'none')
          .map((it) => safePick(it, ['name', 'value'])),
        'value',
        'desc',
      );
      return (
        <div className="flex flex-col bg-white rounded-lg shadow text-start">
          <div className="p-3 text-white rounded-t-lg bg-primary">
            {moment(label).format('MM/DD/YY')}
          </div>
          {data.length > 1 && (
            <div className="flex flex-col">
              <div className="flex items-center px-3 py-2">
                <span className="mr-2 text-lg font-semibold text-primary">
                  {sumBy(data, 'value')}
                </span>
                actioned in total
              </div>
              <div className="mx-3 mt-0 mb-2 divider" />
            </div>
          )}
          {data.map((it, i) => (
            <div className="flex items-center px-3 py-2" key={i}>
              <div className="mr-2 font-semibold text-primary text-end w-9">
                {it.value}
              </div>
              {it.name}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const sortedChartData = useMemo(() => sortBy(chartData, 'date'), [chartData]);

  /**
   * Construct the line, bar, and pie chart components.
   */
  const lineChart = useMemo(() => {
    if (!sortedChartData || !sortedChartData.length) {
      return null;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={sortedChartData}
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.8} />
              <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <ReferenceLine x={last(sortedChartData)?.date} stroke="#d4d4d8" />
          <XAxis
            dataKey="date"
            tickLine={false}
            tick={renderCustomXAxisTick}
            stroke="#d4d4d8"
          />
          <YAxis
            tickLine={false}
            tick={renderCustomYAxisTick}
            stroke="#d4d4d8"
          />
          <Tooltip content={customTooltip} />
          <Line
            type="monotone"
            dataKey="totalMatches"
            stroke={PRIMARY_COLOR}
            dot={renderDot}
          />
          <Area
            name="totalMatches_area"
            type="monotone"
            hide={false}
            dataKey="totalMatches"
            stroke={PRIMARY_COLOR}
            fillOpacity={1}
            fill="url(#colorUv)"
            dot={false}
            activeDot={false}
            legendType="none"
            tooltipType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }, [sortedChartData]);

  const barChart = useMemo(() => {
    if (!sortedChartData) {
      return null;
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedChartData}
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <ReferenceLine
            x={last(sortedChartData)?.date}
            position="end"
            stroke="#d4d4d8"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            tick={renderCustomXAxisTick}
            stroke="#d4d4d8"
          />
          <YAxis
            tickLine={false}
            tick={renderCustomYAxisTick}
            stroke="#d4d4d8"
          />
          <Tooltip content={customTooltip} />
          <Bar
            stackId="a"
            type="monotone"
            dataKey="totalMatches"
            fill={PRIMARY_COLOR}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }, [sortedChartData]);

  const chart = useMemo(() => {
    if (loading) {
      return <ComponentLoading />;
    }
    const chart = (() => {
      switch (chartType) {
        case ChartType.BAR:
          return barChart;
        case ChartType.LINE:
        default:
          return lineChart;
      }
    })();
    return (
      <div className="flex flex-col mr-4 mt-5 mb-4 min-h-[400px]">{chart}</div>
    );
  }, [barChart, chartType, lineChart, loading]);

  const chartTypeButton = (
    type: ChartType,
    icon: ReactNode,
    extraStyle?: string,
  ) => {
    return (
      <div
        key={type}
        className={`flex font-bold border border-solid cursor-pointer h-fit px-2 py-1.5 ${
          chartType === type
            ? 'border-primary bg-primary text-white'
            : 'border-slate-200 text-slate-300'
        } ${extraStyle}`}
        onClick={() => {
          if (chartType !== type) {
            setChartType(type);
          }
        }}
      >
        {icon}
      </div>
    );
  };

  const chartSelection = (
    <div className="flex items-center justify-center">
      {chartTypeButton(
        ChartType.LINE,
        <LineChartOutlined />,
        'rounded-l-full border-r-0',
      )}
      {chartTypeButton(ChartType.BAR, <BarChartOutlined />, 'rounded-r-full')}
    </div>
  );

  const timeWindowSelection = (
    <div className="flex items-center justify-start">
      <DateRangePicker
        initialDateFrom={timeWindow.start}
        initialDateTo={timeWindow.end}
        onUpdate={({ range }) => {
          setTimeWindow({
            start: range.from,
            end: range.to ?? range.from,
          });
        }}
      />
    </div>
  );

  const noActionsInTimeWindow = chartData !== null && chartData.length === 0;

  // TODO: This copy (and all the copy in this component) doesn't really describe
  // the data accurately, as the rule could pass but not have triggered any actions
  // (e.g., a background rule), or have passed and triggered multiple actions.
  const noRuleRunsComponent = (
    <div className="text-center">
      <RuleInsightsEmptyCard
        icon={<LineChartOutlined />}
        title="No Actions"
        subtitle="Your rule has not executed any actions yet. As soon as it does, you'll see the data here."
      />
    </div>
  );

  if (error) {
    return <div />;
  }

  return (
    <div className="flex justify-between w-full pb-2 bg-white border-none text-start">
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between pb-8 mr-4">
          <div className="flex h-full px-4 py-2 rounded-lg bg-slate-100">
            {chartSelection}
            <div className="flex w-px h-full mx-4 my-1 bg-slate-200" />
            {timeWindowSelection}
          </div>
          {totalActionedSubmissionsInTimeWindow === 0 ? null : (
            <RulesDashboardInsightsStats
              stats={[
                {
                  value: totalActionedSubmissionsInTimeWindow.toLocaleString(),
                  title: 'reports actioned on',
                  icon: <InvestmentFilled className="w-10 h-10 text-primary" />,
                },
              ]}
            />
          )}
        </div>
        {loading ? (
          <ComponentLoading />
        ) : noActionsInTimeWindow ? (
          noRuleRunsComponent
        ) : (
          chart
        )}
      </div>
    </div>
  );
}
