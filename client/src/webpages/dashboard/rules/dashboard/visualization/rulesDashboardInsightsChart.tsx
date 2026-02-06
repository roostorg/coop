import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { TapFilled } from '@/icons';
import { ReactComponent as Download } from '@/icons/lni/Web and Technology/download.svg';
import { truncateAndFormatLargeNumber } from '@/utils/number';
import type { TimeDivisionOptions } from '@/webpages/dashboard/overview/Overview';
import flatten from 'lodash/flatten';
import keys from 'lodash/keys';
import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import sortBy from 'lodash/sortBy';
import sumBy from 'lodash/sumBy';
import union from 'lodash/union';
import without from 'lodash/without';
import moment from 'moment';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CSVLink } from 'react-csv';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { Payload } from 'recharts/types/component/DefaultLegendContent';

import ComponentLoading from '../../../../../components/common/ComponentLoading';
import CoopButton from '@/webpages/dashboard/components/CoopButton';

import {
  GQLActionData,
  GQLActionStatisticsFilters,
  GQLActionStatisticsGroupByColumns,
  useGQLActionStatisticsDataLazyQuery,
  useGQLManualReviewDecisionInsightsOrgInfoQuery,
} from '../../../../../graphql/generated';
import { safePick } from '../../../../../utils/misc';
import {
  getDateRange,
  getEarliestDateWithLookback,
  LookbackLength,
} from '../../../../../utils/time';
import { chartColors, PRIMARY_COLOR } from './chartColors';
import { getDisplayNameForGroupByOption } from './insightsUtils';
import RuleInsightsFilterBy from './RuleInsightsFilterBy';
import { TimeWindow } from './RulesDashboardInsights';

export type RuleInsightsChartMetric = 'ACTIONS';

export function getEmptyFilterState(
  lookback: LookbackLength,
): GQLActionStatisticsFilters {
  return {
    actionIds: [],
    ruleIds: [],
    policyIds: [],
    sources: [],
    itemTypeIds: [],
    startDate: getEarliestDateWithLookback(lookback),
    endDate: new Date(),
  };
}

export default function RuleDashboardInsightsChart(props: {
  lookback: LookbackLength;
  timeWindow: TimeWindow;
  timeDivision: TimeDivisionOptions;
  initialGroupBy: GQLActionStatisticsGroupByColumns | undefined;
  title: string;
}) {
  const { lookback, timeWindow, timeDivision, initialGroupBy, title } = props;

  const [selectedGroupBy, setSelectedGroupBy] = useState<
    GQLActionStatisticsGroupByColumns | undefined
  >(initialGroupBy);
  const [hiddenLines, setHiddenLines] = useState<string[]>([]);

  const [savedFilterBys, setSavedFilterBys] =
    useState<GQLActionStatisticsFilters>({
      ...getEmptyFilterState(lookback),
    });

  const [
    getActionStats,
    {
      loading: actionStatsLoading,
      error: actionStatsError,
      data: actionStatsData,
    },
  ] = useGQLActionStatisticsDataLazyQuery();

  const [countsByDay, loading, error] = [
    actionStatsData?.actionStatistics,
    actionStatsLoading,
    actionStatsError,
  ];

  useEffect(() => {
    getActionStats({
      variables: {
        input: {
          timeDivision,
          groupBy: selectedGroupBy ? selectedGroupBy : 'ACTION_ID',
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
  }, [
    getActionStats,
    selectedGroupBy,
    timeWindow.end,
    timeWindow.start,
    timeDivision,
  ]);

  const { data: orgQueryData } =
    useGQLManualReviewDecisionInsightsOrgInfoQuery();

  const getLineNameFromCount = (count: GQLActionData) => {
    if (!selectedGroupBy) {
      return 'All Actions';
    }
    return (() => {
      switch (selectedGroupBy) {
        case GQLActionStatisticsGroupByColumns.ActionSource:
          if (!count.source) {
            return 'Unknown';
          } else {
            switch (count.source) {
              case 'automated-rule':
                return 'Automated Rule';
              case 'mrt-decision':
                return 'Moderator Decision';
              case 'manual-action-run':
                return 'Manual Action Run';
              case 'post-actions':
                return 'Actions Endpoint';
              default:
                return 'Unknown';
            }
          }
        case GQLActionStatisticsGroupByColumns.RuleId:
          if (!count.rule_id) {
            return 'Other';
          }
          const rule = orgQueryData?.myOrg?.rules.find(
            (it) => it.id === count.rule_id,
          );
          return rule ? `${rule.name}` : 'Other';
        case GQLActionStatisticsGroupByColumns.ActionId:
          if (!count.action_id) {
            return 'Other';
          }
          const action = orgQueryData?.myOrg?.actions.find(
            (it) => it.id === count.action_id,
          );
          return action ? `${action.name}` : 'Other';
        case GQLActionStatisticsGroupByColumns.PolicyId:
          if (!count.policy_id) {
            return 'None';
          }
          return (
            orgQueryData?.myOrg?.policies.find(
              (it) => it.id === count.policy_id,
            )?.name ?? 'Other'
          );
        case GQLActionStatisticsGroupByColumns.ItemTypeId:
          if (!count.item_type_id) {
            return 'Other';
          }
          const itemType = orgQueryData?.myOrg?.itemTypes.find(
            (it) => it.id === count.item_type_id,
          );
          return itemType ? `${itemType.name}` : 'Other';
      }
    })();
  };

  const formattedData = countsByDay?.map((it) => {
    const obj: { [key: string]: any } = {
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

  if (error) {
    return <div className="">Error fetching metrics for chart</div>;
  }

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
          <div className="p-3 text-white bg-indigo-400 rounded-tl-lg rounded-tr-lg">
            {label}
          </div>
          <table className="w-full m-2">
            <tbody>
              {data.map((it, i) =>
                it.value && it.value > 0 ? (
                  <tr key={i}>
                    <td className="pr-1 font-semibold text-indigo-400 text-end">
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

  const onSetSelectedGroupBy = (
    option: GQLActionStatisticsGroupByColumns | undefined,
  ) => {
    setSelectedGroupBy(option);
    getActionStats({
      variables: {
        input: {
          groupBy: option ? option : 'ACTION_ID',
          filterBy: {
            actionIds: [],
            ruleIds: [],
            itemTypeIds: [],
            sources: [],
            policyIds: [],
            startDate: timeWindow.start,
            endDate: timeWindow.end,
          },
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeDivision: 'DAY',
        },
      },
    });
  };

  const onSaveFilterBys = (filterBys: GQLActionStatisticsFilters) => {
    setSavedFilterBys(filterBys);
    getActionStats({
      variables: {
        input: {
          timeDivision,
          groupBy: selectedGroupBy ? selectedGroupBy : 'ACTION_ID',
          filterBy: {
            ...filterBys,
            endDate: timeWindow.end,
            startDate: timeWindow.start,
          },
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    });
  };

  const emptyChart = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 rounded bg-slate-100">
      <div className="text-xl">
        We didn't find any results for this query. Try another one!
      </div>
      <CoopButton
        title="Reset Filters"
        onClick={() => onSaveFilterBys(getEmptyFilterState(lookback))}
        size="small"
      />
    </div>
  );

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

  return (
    <div className="flex flex-col w-full p-6 bg-white border border-solid rounded-lg border-slate-200">
      <div className="flex pb-6">
        <div className="flex flex-row justify-between gap-2 grow">
          <div className="flex items-start gap-2">
            <TapFilled className="flex w-6 h-6 text-teal-300" />
            <div className="flex flex-col text-start">
              <div className="pb-2 text-lg font-bold">
                {title}
                {selectedGroupBy &&
                // If we don't have this condition, and if the selectedGroupBy
                // equals 'ACTION_ID', then this graph title displays as
                // 'Actions by Action'. That's a pretty bad title, so we just
                // change it to 'Actions' in that case.
                selectedGroupBy !== 'ACTION_ID'
                  ? ` by ${getDisplayNameForGroupByOption(selectedGroupBy)}`
                  : null}
              </div>
              <div className="text-sm text-slate-400">
                {actionStatsError ? (
                  'Unknown'
                ) : actionStatsLoading ? (
                  <ComponentLoading />
                ) : actionStatsData ? (
                  sumBy(
                    actionStatsData.actionStatistics,
                    'count',
                  ).toLocaleString()
                ) : undefined}
              </div>
            </div>
          </div>
          {!loading && (
            <div className="flex flex-wrap items-start justify-start gap-8">
              <div className="flex flex-col items-start self-center gap-1 text-start">
                <div className="pr-2 text-sm font-semibold text-slate-500 whitespace-nowrap">
                  Group by
                </div>
                <div className="relative block float-left">
                  <Select
                    onValueChange={(value) =>
                      onSetSelectedGroupBy(
                        value as GQLActionStatisticsGroupByColumns | undefined,
                      )
                    }
                    value={selectedGroupBy}
                  >
                    <SelectTrigger size="small" className="w-[180px]">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.values(GQLActionStatisticsGroupByColumns).map(
                          (val) => (
                            <SelectItem value={val} key={val}>
                              {getDisplayNameForGroupByOption(val)}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <RuleInsightsFilterBy
                savedFilterBys={savedFilterBys}
                setSavedFilterBys={onSaveFilterBys}
                emptyFilterState={getEmptyFilterState(lookback)}
              />
              <div className="flex items-end h-full pb-3">
                <CSVLink
                  id="CSVLink"
                  data={finalChartData}
                  filename={`${title} (${timeWindow.start.toLocaleString()} - ${timeWindow.end.toLocaleString()})`}
                  enclosingCharacter={`"`}
                  target="_blank"
                >
                  <Download className="w-4 h-4 text-primary hover:text-primary/70" />
                </CSVLink>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="z-10 flex flex-col w-full h-full min-h-[400px] pb-4">
        {!loading && finalChartData.length === 0 ? (
          emptyChart
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {loading ? (
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
                    value: `Total Actions`,
                    style: { textAnchor: 'middle' },
                    angle: -90,
                    position: 'left',
                    offset: 0,
                  }}
                />
                <Legend content={renderLegend} />
                <Tooltip content={customTooltip} />
                {lineChart}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
