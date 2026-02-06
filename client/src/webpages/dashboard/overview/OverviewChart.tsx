import {
  useGQLActionStatisticsDataLazyQuery,
  useGQLDataForOverviewChartsQuery,
  useGQLGetDecisionCountsLazyQuery,
} from '@/graphql/generated';
import { safePick } from '@/utils/misc';
import { truncateAndFormatLargeNumber } from '@/utils/number';
import { titleCaseEnumString } from '@/utils/string';
import { getDateRange } from '@/utils/time';
import { gql } from '@apollo/client';
import flatten from 'lodash/flatten';
import keys from 'lodash/keys';
import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import sortBy from 'lodash/sortBy';
import sum from 'lodash/sum';
import union from 'lodash/union';
import without from 'lodash/without';
import moment from 'moment';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SVGProps,
} from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Payload } from 'recharts/types/component/DefaultLegendContent';

import ComponentLoading from '@/components/common/ComponentLoading';

import {
  chartColors,
  PRIMARY_COLOR,
} from '../rules/dashboard/visualization/chartColors';
import type {
  ChartType,
  TimeWindow,
} from '../rules/dashboard/visualization/RulesDashboardInsights';
import type { TimeDivisionOptions } from './Overview';

gql`
  query DataForOverviewCharts {
    myOrg {
      users {
        id
        firstName
        lastName
      }
      rules {
        id
        name
      }
    }
  }
`;

type CountPerMetricPerTimeUnit = {
  count: number;
  time: string;
  reviewer_id?: string | null;
  rule_id?: string | null;
};

export default function OverviewChart(props: {
  title: string;
  icon: React.JSXElementConstructor<SVGProps<SVGSVGElement>>;
  iconColor: 'text-teal-300' | 'text-orange-400' | 'text-amber-400';
  metric: 'Decisions' | 'Actions';
  timeDivision: TimeDivisionOptions;
  timeWindow: TimeWindow;
  chartType: Omit<ChartType, 'PIE'>;
}) {
  const {
    title,
    icon: Icon,
    iconColor,
    metric,
    timeDivision,
    timeWindow,
    chartType,
  } = props;
  const [hiddenLines, setHiddenLines] = useState<string[]>([]);
  const {
    data,
    loading: dataQueryLoading,
    error,
  } = useGQLDataForOverviewChartsQuery();
  const users = data?.myOrg?.users;
  const rules = data?.myOrg?.rules;

  const [
    getDecisionCounts,
    { loading: decisionsLoading, error: decisionsError, data: decisionsData },
  ] = useGQLGetDecisionCountsLazyQuery({
    variables: {
      input: {
        timeDivision,
        groupBy: ['REVIEWER_ID'],
        filterBy: {
          actionIds: [],
          itemTypeIds: [],
          type: [],
          policyIds: [],
          queueIds: [],
          reviewerIds: [],
          endDate: timeWindow.end,
          startDate: timeWindow.start,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });

  const [
    getActionStats,
    {
      loading: actionStatsLoading,
      error: actionStatsError,
      data: actionStatsData,
    },
  ] = useGQLActionStatisticsDataLazyQuery({
    variables: {
      input: {
        timeDivision,
        groupBy: 'RULE_ID',
        filterBy: {
          sources: [],
          actionIds: [],
          ruleIds: [],
          itemTypeIds: [],
          policyIds: [],
          endDate: timeWindow.end,
          startDate: timeWindow.start,
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  });

  useEffect(() => {
    switch (metric) {
      case 'Decisions':
        getDecisionCounts();
        break;
      case 'Actions':
        getActionStats();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, timeWindow.start, timeWindow.end]);

  const countsPerMetricPerTimeUnit = useMemo(() => {
    switch (metric) {
      case 'Decisions':
        return decisionsData?.getDecisionCounts?.map((it) => ({
          count: it.count,
          time: it.time,
          reviewer_id: it.reviewer_id,
        }));
      case 'Actions':
        return actionStatsData?.actionStatistics?.map((it) => ({
          count: it.count,
          time: it.time,
          rule_id: it.rule_id,
        }));
    }
  }, [metric, decisionsData, actionStatsData]);

  const emptyChart = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 rounded bg-slate-100">
      <div className="text-xl">We didn't find any results for this query</div>
    </div>
  );

  const renderLegend = useCallback(
    (props: { payload?: Payload[] | undefined }) => {
      const entries = props.payload?.filter((entry) => entry.type !== 'none');
      return (
        <div className="flex justify-center w-full">
          <div className="flex flex-wrap justify-center max-w-[80%] px-4 py-2 overflow-auto rounded gap-x-3 gap-y-2 bg-gray-50 max-h-24">
            {entries?.map((entry, index) => (
              <div
                key={index}
                className={`flex text-sm cursor-pointer text-zinc-500 hover:opacity-70 items-center gap-1.5 text-start ${
                  hiddenLines.includes(entry.value)
                    ? 'opacity-30 hover:opacity-50'
                    : ''
                }`}
                onClick={() => {
                  if (hiddenLines.includes(entry.value)) {
                    setHiddenLines(
                      hiddenLines.filter((it) => it !== entry.value),
                    );
                  } else {
                    setHiddenLines([...hiddenLines, entry.value]);
                  }
                }}
              >
                <div
                  style={{
                    backgroundColor:
                      entries?.length === 1
                        ? PRIMARY_COLOR
                        : chartColors[index % chartColors.length],
                  }}
                  className={`flex rounded-full h-4 w-4`}
                />
                {entry.value}
              </div>
            ))}
          </div>
        </div>
      );
    },
    [hiddenLines],
  );

  const renderCustomXAxisTick = ({
    x,
    y,
    payload,
  }: {
    x: number;
    y: number;
    payload: { value: string };
  }) => {
    return (
      <text x={x - 4} y={y + 16} fill="#71717a" className="pt-3 text-zinc-500">
        {payload.value.slice(5)}
      </text>
    );
  };

  const renderCustomYAxisTick = ({
    x,
    y,
    payload,
  }: {
    x: number;
    y: number;
    payload: { value: string };
  }) => (
    <text
      textAnchor="end"
      x={x}
      y={y + 4}
      fill="#71717a"
      className="pr-3 text-zinc-500"
    >
      {truncateAndFormatLargeNumber(Number(payload.value))}
    </text>
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
        <div className="flex flex-col max-w-sm overflow-x-scroll bg-white rounded-lg shadow text-start">
          <div className="p-3 text-white rounded-tl-lg rounded-tr-lg bg-primary">
            {label}
          </div>
          <table className="w-full m-2">
            <tbody>
              {data.map((it, i) =>
                it.value && it.value > 0 ? (
                  <tr key={i}>
                    <td className="pr-1 font-semibold text-primary text-end">
                      {it.value?.toLocaleString()}
                    </td>
                    <td className="pl-1 font-medium text-slate-700">
                      {it.name}
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  const getLineNameFromCount = (count: CountPerMetricPerTimeUnit) => {
    switch (metric) {
      case 'Decisions':
        const user = count.reviewer_id
          ? users?.find((user) => user.id === count.reviewer_id)
          : null;
        return user ? `${user.firstName} ${user.lastName}` : 'Other';
      case 'Actions':
        if (!count.rule_id) {
          return 'Other';
        }
        return (
          rules?.find((rule) => rule.id === count.rule_id)?.name ?? 'Other'
        );
    }
  };

  const formattedData = countsPerMetricPerTimeUnit?.map((it) => {
    const obj: { [key: string]: string | number } = {
      ds: moment(new Date(parseInt(it.time)))
        .local()
        .format(`YYYY-MM-DD${timeDivision === 'HOUR' ? ' HH:mm' : ''}`),
    };
    obj[getLineNameFromCount(it)] = it.count;
    return obj;
  });

  // get all timestamps in the range that the chart will display,
  // by the selected time division / granularity
  const allDatesArray = getDateRange(
    timeWindow.start,
    timeWindow.end,
    timeDivision,
  );

  // Add the complete set of dates to our data array, so the resulting
  // charts do not having missing x axis values
  const formattedDataWithAllDates = [
    ...(formattedData ? formattedData : []),
    ...allDatesArray,
  ];

  const groupedData = formattedDataWithAllDates.reduce((result, item) => {
    const ds = item.ds;

    if (!(ds in result)) {
      result[ds] = { ds };
    }

    // Merge the inner object into the result object
    Object.assign(result[ds], item);

    return result;
  }, {});

  const sortedChartData = useMemo(
    () => (groupedData ? sortBy(Object.values(groupedData), 'ds') : []),
    [groupedData],
  );

  const uniqueLines = without(
    union(flatten(map(sortedChartData, (e) => keys(e)))),
    'ds',
  );

  const finalChartData = sortedChartData.map((it) => {
    const obj: { [key: string]: any } = {
      ds: it.ds,
    };
    uniqueLines.forEach((line) => {
      obj[line] = it[line] ?? 0;
    });
    return obj;
  });

  const lineChart = uniqueLines.map((name, index) => {
    return (
      <Line
        hide={hiddenLines.includes(name)}
        key={index}
        connectNulls
        name={name}
        type="monotone"
        dataKey={name}
        stroke={
          uniqueLines.length === 1
            ? PRIMARY_COLOR
            : chartColors[index % chartColors.length]
        }
        dot={false}
      />
    );
  });

  const barChart = uniqueLines.map((name, index) => (
    <Bar
      hide={hiddenLines.includes(name)}
      key={index}
      name={name}
      stackId="a"
      type="monotone"
      dataKey={name}
      fill={
        uniqueLines.length === 1
          ? PRIMARY_COLOR
          : chartColors[index % chartColors.length]
      }
    />
  ));

  if (error || decisionsError || actionStatsError) {
    throw error ?? decisionsError ?? actionStatsError!;
  }

  const loading = decisionsLoading || actionStatsLoading;

  return (
    <div className="flex flex-col w-full p-6 bg-white border border-solid rounded-lg border-slate-200">
      <div className="flex pb-6">
        <div className="flex items-start gap-2">
          <Icon className={`flex w-6 h-6 ${iconColor}`} />
          <div className="flex justify-between gap-2 grow">
            <div className="flex flex-col text-start">
              <div className="pb-2 text-lg font-bold">{title}</div>
              <div className="text-sm text-slate-400">
                {loading ? (
                  <ComponentLoading />
                ) : (
                  `Total: ${sum(
                    countsPerMetricPerTimeUnit?.map((it) => it.count),
                  ).toLocaleString()}`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="z-10 flex flex-col w-full h-full min-h-[400px] pb-4">
        {!loading && finalChartData.length === 0 ? (
          emptyChart
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {loading || dataQueryLoading ? (
              <ComponentLoading />
            ) : (
              <ComposedChart data={finalChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="ds"
                  tickLine={false}
                  tick={renderCustomXAxisTick}
                />
                <YAxis
                  tick={renderCustomYAxisTick}
                  tickLine={false}
                  stroke="#d4d4d8"
                  label={{
                    value: `Total ${titleCaseEnumString(metric)}`,
                    style: { textAnchor: 'middle' },
                    angle: -90,
                    position: 'left',
                    offset: 0,
                  }}
                />
                <Legend content={renderLegend} />
                <Tooltip content={customTooltip} />
                {chartType === 'BAR' ? barChart : lineChart}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
