import './recharts.css';

import { DateRangePicker } from '@/coop-ui/DateRangePicker';
import { InvestmentFilled, PieChartAltFilled } from '@/icons';
import { truncateAndFormatLargeNumber } from '@/utils/number';
import {
  BarChartOutlined,
  DownOutlined,
  LineChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import capitalize from 'lodash/capitalize';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import keys from 'lodash/keys';
import last from 'lodash/last';
import map from 'lodash/map';
import maxBy from 'lodash/maxBy';
import mergeWith from 'lodash/mergeWith';
import omit from 'lodash/omit';
import orderBy from 'lodash/orderBy';
import sortBy from 'lodash/sortBy';
import sum from 'lodash/sum';
import sumBy from 'lodash/sumBy';
import union from 'lodash/union';
import without from 'lodash/without';
import moment from 'moment';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { Chart } from 'react-google-charts';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { Payload } from 'recharts/types/component/DefaultLegendContent';

import ComponentLoading from '../../../../../components/common/ComponentLoading';

import {
  useGQLPolicyRollupDataQuery,
  useGQLRulesDashboardInsightsQuery,
} from '../../../../../graphql/generated';
import { safePick } from '../../../../../utils/misc';
import { WEEK } from '../../../../../utils/time';
import RuleInsightsEmptyCard from '../../info/insights/RuleInsightsEmptyCard';
import { chartColors, PRIMARY_COLOR } from './chartColors';
import { rollUpPolicyCounts } from './insightsUtils';
import RulesDashboardInsightsStats from './RulesDashboardInsightsStats';

export type TimeWindow = {
  start: Date;
  end: Date;
};

/**
 * NOTE: This order should be preserved. We render these
 * options in the UI in the same order in which they appear here.
 */
export enum InsightsGroupByOption {
  NONE = 'NONE',
  POLICY = 'POLICY',
  ACTION = 'ACTION',
  TAG = 'TAG',
}

export enum ChartType {
  LINE = 'LINE',
  BAR = 'BAR',
  PIE = 'PIE',
}

export type Policy = {
  name: string;
  id: string;
};

gql`
  query RulesDashboardInsights {
    allRuleInsights {
      actionedSubmissionsByPolicyByDay {
        date
        count
        policy {
          name
          id
        }
      }
      actionedSubmissionsByTagByDay {
        date
        count
        tag
      }
      actionedSubmissionsByActionByDay {
        date
        count
        action {
          name
        }
      }
      actionedSubmissionsByDay {
        date
        count
      }
      totalSubmissionsByDay {
        date
        count
      }
    }
  }

  query PolicyRollupData {
    myOrg {
      id
      policies {
        id
        name
        parentId
      }
    }
  }
  query ActionStatisticsData($input: ActionStatisticsInput!) {
    actionStatistics(input: $input) {
      item_type_id
      action_id
      policy_id
      rule_id
      source
      count
      time
      count
    }
  }
`;

export default function RulesDashboardInsights() {
  const { loading, error, data } = useGQLRulesDashboardInsightsQuery();

  const {
    loading: policiesLoading,
    error: policiesError,
    data: policiesData,
  } = useGQLPolicyRollupDataQuery();
  const {
    actionedSubmissionsByPolicyByDay,
    actionedSubmissionsByTagByDay,
    actionedSubmissionsByActionByDay,
    totalSubmissionsByDay,
    actionedSubmissionsByDay,
  } = data?.allRuleInsights ?? {};

  const reducedPolicies = useMemo(() => {
    const policies = policiesData?.myOrg?.policies;

    return !actionedSubmissionsByPolicyByDay || !policies
      ? []
      : rollUpPolicyCounts(policies, actionedSubmissionsByPolicyByDay);
  }, [actionedSubmissionsByPolicyByDay, policiesData]);

  const [groupByOption, setGroupBy] = useState(InsightsGroupByOption.NONE);
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);
  const [chartType, setChartType] = useState(ChartType.LINE);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>({
    start: new Date(Date.now() - WEEK),
    end: new Date(),
  });

  const getDataInTimeWindow = useCallback(
    <T extends { readonly date: string | Date }>(
      arr: readonly T[] | null | undefined,
    ) => {
      return arr?.filter((elemWithDate) => {
        const time = new Date(elemWithDate.date).getTime();
        return (
          time > timeWindow.start.getTime() && time < timeWindow.end.getTime()
        );
      });
    },
    [timeWindow],
  );

  /**
   * Remove data older than selected time window, and update its
   * structure to play nicely with the recharts components. Recharts
   * expects objects in the form
   *
   * {
   *    date: '2022-05-01',
   *    hate: 145,
   *    violence: 843,
   *    sexual: 8993,
   * }
   *
   * but our GraphQL queries fetch data in the form (e.g. for policies):
   *
   * {
   *    date: '2022-05-01',
   *    count: 200,
   *    policy: {
   *       name: 'hate',
   *    }
   * }
   *
   * So, we transform our GraphQL results into a standard format:
   *
   * {
   *    date: '2022-05-01',
   *    count: 200,
   *    policy: 'hate'  // --> or, `tag: 'some_tag'`, or `action: 'some_action'`
   * }
   *
   * Note: for actionedSubmissionsByDay, we omit the third prop, which isn't needed.
   */

  const filteredActionedSubmissionsByPolicyByDay = useMemo(
    () =>
      getDataInTimeWindow(reducedPolicies)?.map((it) => ({
        ...it,
        policy: it.policy.name,
      })),
    [reducedPolicies, getDataInTimeWindow],
  );
  const filteredActionedSubmissionsByTagByDay = useMemo(
    () => getDataInTimeWindow(actionedSubmissionsByTagByDay),
    [actionedSubmissionsByTagByDay, getDataInTimeWindow],
  );
  const filteredActionedSubmissionsByActionByDay = useMemo(
    () =>
      getDataInTimeWindow(actionedSubmissionsByActionByDay)?.map((it) => ({
        ...it,
        action: it.action.name,
      })),
    [actionedSubmissionsByActionByDay, getDataInTimeWindow],
  );
  const filteredActionedSubmissionsByDay = useMemo(
    () => getDataInTimeWindow(actionedSubmissionsByDay),
    [actionedSubmissionsByDay, getDataInTimeWindow],
  );
  const filteredTotalSubmissionsByDay = useMemo(
    () => getDataInTimeWindow(totalSubmissionsByDay),
    [totalSubmissionsByDay, getDataInTimeWindow],
  );

  const totalActionedSubmissionsInLookback = useMemo(
    () =>
      filteredActionedSubmissionsByDay
        ? sum(filteredActionedSubmissionsByDay.map((it) => it.count))
        : 0,
    [filteredActionedSubmissionsByDay],
  );

  const percentActioned = useMemo(() => {
    if (!filteredTotalSubmissionsByDay) {
      return null;
    }
    const submissions = sum(
      filteredTotalSubmissionsByDay.map((it) => it.count),
    );
    return submissions > 0
      ? (100.0 * totalActionedSubmissionsInLookback) / submissions
      : 0;
  }, [totalActionedSubmissionsInLookback, filteredTotalSubmissionsByDay]);

  /**
   * NB: This is only necessary for displaying charts that have
   * some sort of group-by selected.
   *
   * This function takes an array of objects shaped like
   *
   * {
   *    date: '2022-01-01',
   *    count: 100,
   *    policy: 'hate'
   * }
   *
   * and converts it to an array of objects that we can pass directly
   * to the Recharts components. We first group these elements by date,
   * and then consolidate data from the same date into one object, with
   * all the relevant data for that date.
   * The result - for the group-by-policy example - should be:
   * [
   *    {
   *      date: '2022-05-01',
   *      hate: 145,
   *      violence: 843,
   *      sexual: 8993,
   *    },
   *    {
   *      date: '2022-05-02',
   *      hate: 192,
   *      violence: 803,
   *      sexual: 8912,
   *    },
   *    ...
   * ]
   */
  const constructChartData = useCallback(
    (valuesWithDate: any[]) =>
      map(
        groupBy(
          // Transform { date, count, policy } object to { date, 'policy_name': count }
          valuesWithDate.map((valueWithDate) => ({
            date: valueWithDate.date,
            [valueWithDate[groupByOption.toLowerCase()]]: valueWithDate.count,
          })),
          'date',
        ),
        // Combine all objects w/ the same date into one shared object with all
        // data from that date. For example, we turn
        // [{ date_1, policy_1 }, { date_1, policy_2 }] into { date_1, policy_1, policy_2 }
        (vals, date) => ({
          date,
          ...Object.assign({}, ...vals.map((val) => omit(val, 'date'))),
        }),
      ),
    [groupByOption],
  );

  /**
   * Construct the object that we'll pass into the `data` prop
   * in the Rechart component. We need slightly different
   * logic based on how we're grouping the actioning data (i.e.
   * by policy, by tag, by action, or not at all).
   *
   * TODO: fix up this type.
   */
  const chartData: any[] | undefined | null = useMemo(() => {
    switch (groupByOption) {
      case InsightsGroupByOption.NONE:
        return filteredActionedSubmissionsByDay?.map((it) => ({
          date: it.date,
          'All Live Actions': it.count,
        }));
      case InsightsGroupByOption.POLICY:
        return constructChartData(
          filteredActionedSubmissionsByPolicyByDay ?? [],
        );
      case InsightsGroupByOption.TAG:
        return constructChartData(filteredActionedSubmissionsByTagByDay ?? []);
      case InsightsGroupByOption.ACTION:
        return constructChartData(
          filteredActionedSubmissionsByActionByDay ?? [],
        );
    }
  }, [
    groupByOption,
    filteredActionedSubmissionsByDay,
    filteredActionedSubmissionsByPolicyByDay,
    filteredActionedSubmissionsByTagByDay,
    filteredActionedSubmissionsByActionByDay,
    constructChartData,
  ]);

  const sortedChartData = useMemo(() => sortBy(chartData, 'date'), [chartData]);

  const sumNums = (a: number, b: number) => a + b;

  const chartDataSums = useMemo(
    () =>
      chartData?.reduce(
        (prev, curr) => mergeWith(prev, omit(curr, 'date'), sumNums),
        omit(chartData[0], 'date'),
      ) ?? [],
    [chartData],
  );
  const lineWithMaxSum = maxBy(
    Object.keys(chartDataSums),
    (key) => chartDataSums[key],
  );

  /**
   * Allow user to hide specific lines/bars in the chart by clicking
   * the corresponding key in the legend.
   */
  const selectCategory = useCallback(
    (payload: Payload) => {
      if (hiddenCategories.includes(payload.value)) {
        setHiddenCategories(without(hiddenCategories, payload.value));
      } else {
        setHiddenCategories([...hiddenCategories, payload.value]);
      }
    },
    [hiddenCategories],
  );

  const renderCustomXAxisTick = ({ x, y, payload }: any) => {
    return (
      <text
        x={x - 24}
        y={y + 16}
        fill="#71717a"
        className="pt-3 text-slate-500"
      >
        {moment(payload.value).format('MM/DD/YY')}
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
      {truncateAndFormatLargeNumber(Number(payload.value))}
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

  const renderColorfulLegendText = useCallback(
    (value: string, { type }: any) => {
      if (type === 'none') {
        return null;
      }
      return (
        <span
          className={`font-semibold pl-0.5 cursor-pointer hover:opacity-70 ${
            hiddenCategories.includes(value)
              ? 'text-slate-200'
              : 'text-slate-500'
          }`}
        >
          {value}
        </span>
      );
    },
    [hiddenCategories],
  );

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
              <div className="mx-3 mb-2 divider" />
            </div>
          )}
          {data.map((it, i) => (
            <div key={i} className="flex items-center px-3 py-2">
              <div className="w-8 mr-2 font-semibold text-coop-blue text-end">
                {it.value?.toLocaleString()}
              </div>
              <div className="font-medium text-slate-700">{it.name}</div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  /**
   * Construct the line, bar, and pie chart components.
   */
  const lineChart = useMemo(() => {
    if (!sortedChartData || !sortedChartData.length) {
      return null;
    }
    const uniqueLines = without(
      union(flatten(map(sortedChartData, (e) => keys(e)))),
      'date',
    );

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sortedChartData} margin={{ top: 0, right: 40 }}>
          <defs>
            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY_COLOR} stopOpacity={0.8} />
              <stop offset="95%" stopColor={PRIMARY_COLOR} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <ReferenceLine x={last(sortedChartData).date} stroke="#d4d4d8" />
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
          <Legend
            onClick={selectCategory}
            formatter={renderColorfulLegendText}
            iconType="circle"
            align="left"
            payload={uniqueLines.map((name, index) => ({
              value: name,
              color: hiddenCategories.includes(name)
                ? '#d1d5db'
                : chartColors[index % chartColors.length],
            }))}
          />
          {uniqueLines.map((name, index) => (
            <React.Fragment key={index}>
              <Line
                name={name}
                type="monotone"
                dataKey={name}
                hide={hiddenCategories.includes(name)}
                stroke={chartColors[index % chartColors.length]}
                dot={name === lineWithMaxSum ? renderDot : false}
              />
              {uniqueLines.length === 1 && (
                <Area
                  name={`${name}_area`}
                  type="monotone"
                  dataKey={name}
                  hide={hiddenCategories.includes(name)}
                  stroke={chartColors[index % chartColors.length]}
                  fillOpacity={1}
                  fill="url(#colorUv)"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  tooltipType="none"
                />
              )}
            </React.Fragment>
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }, [
    sortedChartData,
    selectCategory,
    hiddenCategories,
    lineWithMaxSum,
    renderColorfulLegendText,
  ]);

  const barChart = useMemo(() => {
    if (!sortedChartData) {
      return null;
    }
    const uniqueBars = without(
      union(flatten(map(sortedChartData, (e) => keys(e)))),
      'date',
    );

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
          <Legend
            onClick={selectCategory}
            formatter={renderColorfulLegendText}
            iconType="circle"
            align="left"
            payload={uniqueBars.map((name, index) => ({
              value: name,
              color: chartColors[index % chartColors.length],
            }))}
          />
          {uniqueBars.map((name, index) => (
            <Bar
              key={index}
              name={name}
              stackId="a"
              hide={hiddenCategories.includes(name)}
              type="monotone"
              dataKey={name}
              fill={chartColors[index % chartColors.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }, [
    sortedChartData,
    hiddenCategories,
    selectCategory,
    renderColorfulLegendText,
  ]);

  /**
   * The pie chart has a different data schema than bar and line charts
   * because it aggregates data across multiple dates into one value.
   * We therefore do some custom logic here.
   */
  const pieChart = useMemo(() => {
    if (!sortedChartData) {
      return null;
    }
    const combinedChartData = sortedChartData
      .flatMap((it: any) => omit(it, 'date'))
      .reduce(
        (prev, curr) => {
          Object.keys(prev).forEach((it) => {
            curr[it] = (curr[it] ?? 0) + prev[it];
          });
          return curr;
        },
        {} as { [k: string]: string },
      );
    const pieChartData = Object.keys(combinedChartData).map((category) => [
      category,
      combinedChartData[category],
    ]);

    return (
      <Chart
        chartType="PieChart"
        data={[['category', 'total'], ...pieChartData]}
        options={{
          pieSliceText: 'percentage',
          pieStartAngle: 100,
          pieHole: 0.5,
        }}
        width={'100%'}
        height={'100%'}
      />
    );
  }, [sortedChartData]);

  const chart = useMemo(() => {
    if (loading || policiesLoading) {
      return <ComponentLoading />;
    }
    const chart = (() => {
      switch (chartType) {
        case ChartType.LINE:
          return lineChart;
        case ChartType.BAR:
          return barChart;
        case ChartType.PIE:
          return pieChart;
      }
    })();
    return (
      <div className="flex mt-9 mb-4 min-h-[400px]">
        {chart}
        {totalActionedSubmissionsInLookback === 0 ? null : (
          <RulesDashboardInsightsStats
            stats={[
              {
                value: totalActionedSubmissionsInLookback.toLocaleString(),
                title: 'items actioned',
                icon: <InvestmentFilled className="w-10 h-10 text-primary" />,
              },
              ...(percentActioned
                ? [
                    {
                      value: `${String(
                        Math.round(percentActioned * 100) / 100,
                      )}%`,
                      title: 'of items were actioned on average each day',
                      icon: (
                        <PieChartAltFilled className="w-10 h-10 text-primary" />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>
    );
  }, [
    loading,
    policiesLoading,
    totalActionedSubmissionsInLookback,
    percentActioned,
    chartType,
    lineChart,
    barChart,
    pieChart,
  ]);

  const groupByMenuButton = (option: InsightsGroupByOption) => {
    return (
      <div
        className={`cursor-pointer p-3 m-1 text-start rounded-lg font-medium ${
          groupByOption === option
            ? 'text-white bg-primary'
            : 'bg-white hover:bg-primary/20'
        }`}
        key={`${option}_option`}
        onClick={() => {
          setGroupBy(option);
          setGroupByMenuVisible(false);
          setHiddenCategories([]);
        }}
      >
        {capitalize(option.toLowerCase())}
      </div>
    );
  };

  const groupBySelection = (
    <div className="relative self-center block float-left text-start">
      <div
        onClick={() => setGroupByMenuVisible(!groupByMenuVisible)}
        className="rounded-lg border border-solid border-[#d4d4d8] bg-white text-black font-medium hover:opacity-70"
      >
        Group by
        {groupByOption !== InsightsGroupByOption.NONE
          ? `: ${capitalize(groupByOption.toLowerCase())}`
          : null}
        <DownOutlined className="text-[10px]" />
      </div>
      {groupByMenuVisible && (
        <div className="flex flex-col bg-white absolute border border-solid border-[#d4d4d8] rounded-lg shadow mt-1 p-2 min-w-[240px] z-10">
          {Object.values(InsightsGroupByOption).map((option) =>
            groupByMenuButton(option),
          )}
        </div>
      )}
    </div>
  );

  const lookbackSelection = (
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

  const chartTypeButton = (type: ChartType, icon: ReactNode) => {
    return (
      <div
        className={`flex justify-center items-center border-none rounded-full m-2 p-2 cursor-pointer w-9 h-9 ${
          chartType === type
            ? 'text-white bg-primary'
            : 'bg-[#f6f6f6] text-black hover:bg-primary/20'
        }`}
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
      {chartTypeButton(ChartType.LINE, <LineChartOutlined />)}
      {chartTypeButton(ChartType.BAR, <BarChartOutlined />)}
      {chartTypeButton(ChartType.PIE, <PieChartOutlined />)}
    </div>
  );

  if (error || policiesError) {
    throw error ?? policiesError!;
  }

  return (
    <div className="flex">
      <div className="z-10 flex flex-col w-full pb-4">
        <div className="flex items-center">
          <div className="flex px-4 py-2 rounded-lg bg-slate-50">
            {chartSelection}
            <div className="inline-block w-px mx-4 my-1 bg-slate-200" />
            {lookbackSelection}
            <div className="inline-block w-px mx-4 my-1 bg-slate-200" />
            {groupBySelection}
          </div>
        </div>
        {loading ? (
          <ComponentLoading />
        ) : totalActionedSubmissionsInLookback === 0 ? (
          <RuleInsightsEmptyCard
            icon={<LineChartOutlined />}
            title="No Actions"
            subtitle="Your rules have not executed any actions yet within this time window."
          />
        ) : (
          chart
        )}
      </div>
    </div>
  );
}
