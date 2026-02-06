import { truncateAndFormatLargeNumber } from '@/utils/number';
import {
  BarChartOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Tooltip as AntTooltip } from 'antd';
import flatten from 'lodash/flatten';
import keys from 'lodash/keys';
import map from 'lodash/map';
import mergeWith from 'lodash/mergeWith';
import omit from 'lodash/omit';
import orderBy from 'lodash/orderBy';
import sortBy from 'lodash/sortBy';
import sumBy from 'lodash/sumBy';
import union from 'lodash/union';
import without from 'lodash/without';
import moment from 'moment';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CSVLink } from 'react-csv';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { Payload } from 'recharts/types/component/DefaultLegendContent';

import ComponentLoading from '../../../../components/common/ComponentLoading';
import CoopButton from '../../components/CoopButton';

import {
  GQLDecisionCount,
  GQLDecisionCountFilterByInput,
  GQLDecisionCountGroupByColumns,
  GQLJobCountFilterByInput,
  GQLJobCountGroupByColumns,
  GQLJobCreationCount,
  GQLJobCreationFilterByInput,
  GQLJobCreationGroupByColumns,
  GQLJobCreationSourceOptions,
  GQLResolvedJobCount,
  useGQLGetDecisionCountsLazyQuery,
  useGQLGetJobCreationCountsLazyQuery,
  useGQLGetResolvedJobCountsLazyQuery,
  useGQLGetSkippedJobCountsLazyQuery,
  useGQLManualReviewDecisionInsightsOrgInfoQuery,
  type GQLSkippedJobCount,
  type GQLSkippedJobCountGroupByColumns,
  type GQLSkippedJobFilterByInput,
} from '../../../../graphql/generated';
import { safePick } from '../../../../utils/misc';
import { titleCaseEnumString } from '../../../../utils/string';
import { getDateRange } from '../../../../utils/time';
import type { TimeDivisionOptions } from '../../overview/Overview';
import {
  chartColors,
  PRIMARY_COLOR,
} from '../../rules/dashboard/visualization/chartColors';
import {
  ChartType,
  TimeWindow,
} from '../../rules/dashboard/visualization/RulesDashboardInsights';
import ManualReviewDashboardInsightsFilterBy, {
  ManualReviewDashboardInsightsFilterByInput,
} from './ManualReviewDashboardInsightsFilterBy';
import ManualReviewDashboardInsightsGroupBy, {
  getDisplayNameForGroupByOption,
  ManualReviewDashboardInsightsGroupByColumns,
} from './ManualReviewDashboardInsightsGroupBy';

gql`
  query ManualReviewDecisionInsightsOrgInfo {
    myOrg {
      id
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      users {
        id
        firstName
        lastName
      }
      policies {
        id
        name
      }
      mrtQueues {
        id
        name
      }
      itemTypes {
        ... on ItemTypeBase {
          id
          name
        }
      }
      rules {
        ... on ContentRule {
          id
          name
        }
        ... on UserRule {
          id
          name
        }
      }
    }
  }

  query getDecisionCounts($input: GetDecisionCountInput!) {
    getDecisionCounts(input: $input) {
      count
      time
      type
      action_id
      policy_id
      queue_id
      reviewer_id
    }
  }

  query getJobCreationCounts($input: GetJobCreationCountInput!) {
    getJobCreationCounts(input: $input) {
      count
      time
      policyId
      queueId
      itemTypeId
      ruleId
      source
    }
  }

  query getResolvedJobCounts($input: GetResolvedJobCountInput!) {
    getResolvedJobCounts(input: $input) {
      count
      time
      reviewerId
      queueId
    }
  }

  query getSkippedJobCounts($input: GetSkippedJobCountInput!) {
    getSkippedJobCounts(input: $input) {
      count
      time
      reviewerId
      queueId
    }
  }
`;

export type ManualReviewDashboardInsightsChartMetric =
  | 'DECISIONS'
  | 'JOBS'
  | 'REVIEWED_JOBS'
  | 'SKIPPED_JOBS';

export function getEmptyFilterState(
  metric: ManualReviewDashboardInsightsChartMetric,
  timeWindow: TimeWindow,
): ManualReviewDashboardInsightsFilterByInput {
  switch (metric) {
    case 'DECISIONS':
      return {
        actionIds: [],
        itemTypeIds: [],
        policyIds: [],
        queueIds: [],
        reviewerIds: [],
        type: [],
        startDate: timeWindow.start,
        endDate: timeWindow.end,
      };
    case 'JOBS':
      return {
        itemTypeIds: [],
        policyIds: [],
        queueIds: [],
        sources: [],
        ruleIds: [],
        startDate: timeWindow.start,
        endDate: timeWindow.end,
      };
    case 'REVIEWED_JOBS':
    case 'SKIPPED_JOBS':
      return {
        queueIds: [],
        reviewerIds: [],
        startDate: timeWindow.start,
        endDate: timeWindow.end,
      };
  }
}

export default function ManualReviewDashboardInsightsChart(props: {
  timeWindow: TimeWindow;
  initialChartType: ChartType;
  initialGroupBy:
    | Array<ManualReviewDashboardInsightsGroupByColumns>
    | undefined;
  metric: ManualReviewDashboardInsightsChartMetric;
  title?: string;
  isCustomTitle?: boolean;
  initialTimeDivision?: TimeDivisionOptions;
  initialFilterBy?: Partial<ManualReviewDashboardInsightsFilterByInput>;
  hideGroupBy?: boolean;
  hideFilterBy?: boolean;
  hideTotal?: boolean;
  hideChartSelection?: boolean;
  hideBorder?: boolean;
  hideOptions?: boolean;
  infoText?: string;
  narrowMode?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onSelectGroupBy?: (
    groupBy: ManualReviewDashboardInsightsGroupByColumns | undefined,
  ) => void;
  onUpdateFilterBy?: (
    filterBy: ManualReviewDashboardInsightsFilterByInput,
  ) => void;
  onSelectTimeDivision?: (timeDivision: TimeDivisionOptions) => void;
}) {
  const {
    timeWindow,
    initialChartType,
    initialGroupBy,
    metric,
    title,
    isCustomTitle = false,
    initialTimeDivision = 'DAY',
    initialFilterBy,
    hideGroupBy = false,
    hideFilterBy = false,
    hideTotal = false,
    hideChartSelection = false,
    hideBorder = false,
    hideOptions = false,
    infoText,
    narrowMode = false,
    onEdit,
    onDelete,
    onSelectGroupBy,
    onUpdateFilterBy,
    onSelectTimeDivision,
  } = props;

  const [selectedGroupBy, setSelectedGroupBy] = useState<
    Array<ManualReviewDashboardInsightsGroupByColumns> | undefined
  >(initialGroupBy);
  const [chartType, setChartType] = useState(initialChartType);
  const [hiddenLines, setHiddenLines] = useState<string[]>([]);
  const [timeDivision, setTimeDivision] =
    useState<TimeDivisionOptions>(initialTimeDivision);

  const [savedFilterBys, setSavedFilterBys] =
    useState<ManualReviewDashboardInsightsFilterByInput>(() => ({
      ...getEmptyFilterState(metric, timeWindow),
      ...(initialFilterBy ?? {}),
    }));

  const [optionsVisible, setOptionsVisible] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const [
    getDecisionCounts,
    { loading: decisionsLoading, error: decisionsError, data: decisionsData },
  ] = useGQLGetDecisionCountsLazyQuery();
  const [
    getJobCreationCounts,
    {
      loading: jobCreationsLoading,
      error: jobCreationsError,
      data: jobCreationsData,
    },
  ] = useGQLGetJobCreationCountsLazyQuery();

  const [
    getResolvedJobCounts,
    {
      loading: resolvedJobLoading,
      error: resolvedJobError,
      data: resolvedJobData,
    },
  ] = useGQLGetResolvedJobCountsLazyQuery();

  const [
    getSkippedJobCounts,
    {
      loading: skippedJobLoading,
      error: skippedJobError,
      data: skippedJobData,
    },
  ] = useGQLGetSkippedJobCountsLazyQuery({ fetchPolicy: 'no-cache' });

  const [countsByDay, loading, error] = (() => {
    switch (metric) {
      case 'DECISIONS':
        return [
          decisionsData?.getDecisionCounts,
          decisionsLoading,
          decisionsError,
        ];
      case 'JOBS':
        return [
          jobCreationsData?.getJobCreationCounts,
          jobCreationsLoading,
          jobCreationsError,
        ];
      case 'REVIEWED_JOBS':
        return [
          resolvedJobData?.getResolvedJobCounts,
          resolvedJobLoading,
          resolvedJobError,
        ];
      case 'SKIPPED_JOBS':
        return [
          skippedJobData?.getSkippedJobCounts,
          skippedJobLoading,
          skippedJobError,
        ];
    }
  })();

  const [
    getTotalDedupedDecisions,
    {
      loading: dedupedQueryLoading,
      error: dedupedQueryError,
      data: dedupedQueryData,
    },
  ] = useGQLGetDecisionCountsLazyQuery();

  useEffect(() => {
    switch (metric) {
      case 'DECISIONS':
        getDecisionCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLDecisionCountGroupByColumns[])
                : [],
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
        getTotalDedupedDecisions({
          variables: {
            input: {
              timeDivision,
              groupBy: [],
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
        break;
      case 'JOBS':
        getJobCreationCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLJobCreationGroupByColumns[])
                : [],
              filterBy: {
                policyIds: [],
                queueIds: [],
                itemTypeIds: [],
                sources: [],
                ruleIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'REVIEWED_JOBS':
        getResolvedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLJobCountGroupByColumns[])
                : [],
              filterBy: {
                queueIds: [],
                reviewerIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'SKIPPED_JOBS':
        getSkippedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLJobCountGroupByColumns[])
                : [],
              filterBy: {
                queueIds: [],
                reviewerIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
    }
  }, [
    getDecisionCounts,
    getJobCreationCounts,
    getTotalDedupedDecisions,
    metric,
    selectedGroupBy,
    timeWindow.end,
    timeWindow.start,
    timeDivision,
    getResolvedJobCounts,
    getSkippedJobCounts,
  ]);

  const { data: orgQueryData } =
    useGQLManualReviewDecisionInsightsOrgInfoQuery();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node)
      ) {
        if (optionsVisible) {
          setOptionsVisible(false);
        }
      }
    };

    if (optionsVisible) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [optionsVisible]);

  const getLineNameFromCount = (
    count:
      | GQLDecisionCount
      | GQLJobCreationCount
      | GQLResolvedJobCount
      | GQLSkippedJobCount,
  ) => {
    if (!selectedGroupBy || selectedGroupBy.length === 0) {
      switch (metric) {
        case 'DECISIONS':
        case 'JOBS':
          return 'All Decisions';
        case 'REVIEWED_JOBS':
          return 'All Jobs';
        case 'SKIPPED_JOBS':
          return 'All Skipped Jobs';
      }
    }
    switch (count.__typename) {
      case 'DecisionCount':
        return (() => {
          const lineName: string[] = [];
          selectedGroupBy.forEach((groupBy) => {
            switch (groupBy as GQLDecisionCountGroupByColumns) {
              case GQLDecisionCountGroupByColumns.Type:
                switch (count.type) {
                  case 'IGNORE':
                    lineName.push('Ignore');
                    break;
                  case 'RELATED_ACTION':
                  case 'CUSTOM_ACTION':
                    lineName.push(
                      orgQueryData?.myOrg?.actions.find(
                        (it) => it.id === count.action_id,
                      )?.name ?? 'Other',
                    );
                    break;
                  case 'SUBMIT_NCMEC_REPORT':
                    lineName.push('Submit NCMEC Report');
                    break;
                  case 'ACCEPT_APPEAL':
                    lineName.push('Accept Appeal');
                    break;
                  case 'REJECT_APPEAL':
                    lineName.push('Reject Appeal');
                    break;
                  case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
                    lineName.push('Move To Different Queue');
                    break;
                  default:
                    lineName.push('Other');
                    break;
                }
                break;
              case GQLDecisionCountGroupByColumns.PolicyId:
                if (!count.policy_id) {
                  lineName.push('None');
                  break;
                }
                lineName.push(
                  orgQueryData?.myOrg?.policies.find(
                    (it) => it.id === count.policy_id,
                  )?.name ?? 'Other',
                );
                break;
              case GQLDecisionCountGroupByColumns.ReviewerId:
                if (!count.reviewer_id) {
                  lineName.push('Other');
                  break;
                }
                const user = orgQueryData?.myOrg?.users.find(
                  (it) => it.id === count.reviewer_id,
                );
                lineName.push(
                  user ? `${user.firstName} ${user.lastName}` : 'Other',
                );
                break;
              case GQLDecisionCountGroupByColumns.QueueId:
                if (!count.queue_id) {
                  lineName.push('Other');
                  break;
                }
                lineName.push(
                  orgQueryData?.myOrg?.mrtQueues.find(
                    (it) => it.id === count.queue_id,
                  )?.name ?? 'Other',
                );
                break;
            }
          });
          return lineName.join(', ');
        })();
      case 'JobCreationCount':
        return (() => {
          const lineName: string[] = [];
          selectedGroupBy.forEach((groupBy) => {
            switch (groupBy as GQLJobCreationGroupByColumns) {
              case GQLJobCreationGroupByColumns.Source:
                if (!count.source) {
                  lineName.push('Unknown');
                  break;
                }
                switch (count.source) {
                  case GQLJobCreationSourceOptions.MrtJob:
                    lineName.push('Moderator');
                    break;
                  case GQLJobCreationSourceOptions.Report:
                    lineName.push('User Report');
                    break;
                  case GQLJobCreationSourceOptions.Appeal:
                    lineName.push('User Appeal');
                    break;
                  case GQLJobCreationSourceOptions.RuleExecution:
                    lineName.push(
                      `Rule: ${
                        orgQueryData?.myOrg?.rules.find(
                          (it) => it.id === count.ruleId,
                        )?.name ?? 'Unknown'
                      }`,
                    );
                    break;
                  case GQLJobCreationSourceOptions.PostActions:
                    lineName.push('Actions Endpoint');
                    break;
                }
                break;
              case GQLJobCreationGroupByColumns.PolicyId:
                if (!count.policyId) {
                  lineName.push('None');
                  break;
                }
                lineName.push(
                  orgQueryData?.myOrg?.policies.find(
                    (it) => it.id === count.policyId,
                  )?.name ?? 'Other',
                );
                break;
              case GQLJobCreationGroupByColumns.ItemTypeId:
                if (!count.itemTypeId) {
                  lineName.push('Other');
                  break;
                }
                lineName.push(
                  orgQueryData?.myOrg?.itemTypes.find(
                    (it) => it.id === count.itemTypeId,
                  )?.name ?? 'Other',
                );
                break;
              case GQLDecisionCountGroupByColumns.QueueId:
                if (!count.queueId) {
                  lineName.push('Other');
                  break;
                }
                lineName.push(
                  orgQueryData?.myOrg?.mrtQueues.find(
                    (it) => it.id === count.queueId,
                  )?.name ?? 'Other',
                );
                break;
            }
          });
          return lineName.join(', ');
        })();
      case 'ResolvedJobCount':
      case 'SkippedJobCount':
        const lineName: string[] = [];
        selectedGroupBy.forEach((groupBy) => {
          switch (groupBy as GQLJobCountGroupByColumns) {
            case GQLJobCountGroupByColumns.ReviewerId:
              if (!count.reviewerId) {
                lineName.push('Other');
                break;
              }
              const user = orgQueryData?.myOrg?.users.find(
                (it) => it.id === count.reviewerId,
              );
              lineName.push(
                user ? `${user.firstName} ${user.lastName}` : 'Other',
              );
              break;
            case GQLJobCountGroupByColumns.QueueId:
              if (!count.queueId) {
                lineName.push('Other');
                break;
              }
              lineName.push(
                orgQueryData?.myOrg?.mrtQueues.find(
                  (it) => it.id === count.queueId,
                )?.name ?? 'Other',
              );
              break;
          }
        });
        return lineName.join(', ');
    }
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

  const sumNums = (a: number, b: number) => a + b;

  const chartDataSums = useMemo(
    () =>
      finalChartData?.reduce(
        (prev, curr) => mergeWith(prev, omit(curr, 'ds'), sumNums),
        omit(finalChartData[0], 'ds'),
      ) ?? [],
    [finalChartData],
  );

  const renderLegend = useCallback(
    (props: { payload?: Payload[] | undefined }) => {
      return (
        <div className="flex flex-wrap p-1 overflow-auto border border-solid rounded gap-1 max-h-24 border-slate-200">
          {props.payload
            ?.filter((entry) => entry.type !== 'none')
            .map((entry, index) => (
              <div
                key={index}
                className={`flex font-semibold cursor-pointer text-zinc-500 hover:opacity-70 items-center gap-1.5 text-start ${
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
                    backgroundColor: chartColors[index % chartColors.length],
                  }}
                  className={`flex rounded-full h-4 w-4`}
                />
                {entry.value}
              </div>
            ))}
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

  const onSetSelectedGroupBy = (
    option: Array<ManualReviewDashboardInsightsGroupByColumns> | undefined,
  ) => {
    setSelectedGroupBy(option);
    if (onSelectGroupBy) {
      onSelectGroupBy(option ? option[0] : undefined);
    }
    switch (metric) {
      case 'DECISIONS':
        getDecisionCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: option
                ? (option as GQLDecisionCountGroupByColumns[])
                : [],
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
        break;
      case 'JOBS':
        getJobCreationCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: option ? (option as GQLJobCreationGroupByColumns[]) : [],
              filterBy: {
                policyIds: [],
                queueIds: [],
                itemTypeIds: [],
                sources: [],
                ruleIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'REVIEWED_JOBS':
        getResolvedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: option ? (option as GQLJobCountGroupByColumns[]) : [],
              filterBy: {
                queueIds: [],
                reviewerIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'SKIPPED_JOBS':
        getSkippedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: option
                ? (option as GQLSkippedJobCountGroupByColumns[])
                : [],
              filterBy: {
                queueIds: [],
                reviewerIds: [],
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
    }
  };

  const onSaveFilterBys = (
    filterBys: ManualReviewDashboardInsightsFilterByInput,
  ) => {
    setSavedFilterBys(filterBys);
    if (onUpdateFilterBy) {
      onUpdateFilterBy(filterBys);
    }
    switch (metric) {
      case 'DECISIONS':
        getDecisionCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLDecisionCountGroupByColumns[])
                : [],
              filterBy: {
                ...(filterBys as GQLDecisionCountFilterByInput),
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        getTotalDedupedDecisions({
          variables: {
            input: {
              // Don't do any 'group by' so we avoid duplicates
              timeDivision,
              groupBy: [],
              filterBy: {
                ...(filterBys as GQLDecisionCountFilterByInput),
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'JOBS':
        getJobCreationCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLJobCreationGroupByColumns[])
                : [],
              filterBy: {
                ...(filterBys as GQLJobCreationFilterByInput),
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'REVIEWED_JOBS':
        getResolvedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLJobCountGroupByColumns[])
                : [],
              filterBy: {
                ...(filterBys as GQLJobCountFilterByInput),
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
      case 'SKIPPED_JOBS':
        getSkippedJobCounts({
          variables: {
            input: {
              timeDivision,
              groupBy: selectedGroupBy
                ? (selectedGroupBy as GQLSkippedJobCountGroupByColumns[])
                : [],
              filterBy: {
                ...(filterBys as GQLSkippedJobFilterByInput),
                endDate: timeWindow.end,
                startDate: timeWindow.start,
              },
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          },
        });
        break;
    }
  };

  const emptyChart = (
    <div className="flex flex-col items-center justify-center p-6 rounded gap-3 bg-slate-100">
      <div className="text-xl">
        We didn't find any results for this query. Try another one!
      </div>
      <CoopButton
        title="Reset Filters"
        onClick={() => onSaveFilterBys(getEmptyFilterState(metric, timeWindow))}
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
        stroke={chartColors[index % chartColors.length]}
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
      fill={chartColors[index % chartColors.length]}
    />
  ));

  const pieChart = (
    <PieChart width={400} height={400}>
      <Pie
        dataKey="value"
        nameKey="name"
        isAnimationActive={false}
        data={Object.entries(chartDataSums).map(([key, value]) => ({
          name: key,
          value,
        }))}
        cx="50%"
        cy="50%"
        outerRadius={80}
        fill={PRIMARY_COLOR}
        label
      >
        {Object.entries(chartDataSums).map((_, index) => (
          <Cell
            key={`cell-${index}`}
            fill={chartColors[index % chartColors.length]}
          />
        ))}
      </Pie>
      <Legend content={(props) => renderLegend(props)} />
      <Tooltip content={customTooltip} />
    </PieChart>
  );

  const chartTypeButton = (
    type: ChartType,
    icon: React.ReactNode,
    extraStyle?: string,
  ) => {
    return (
      <div
        key={type}
        className={`flex font-bold border border-solid cursor-pointer h-fit px-2 py-1.5 ${
          chartType === type
            ? 'border-primary bg-primary text-white'
            : 'border-slate-200 text-slate-300 hover:bg-indigo-100'
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
    <div className="flex items-center">
      {chartTypeButton(
        ChartType.LINE,
        <LineChartOutlined />,
        'rounded-l-full border-r-0',
      )}
      {chartTypeButton(ChartType.BAR, <BarChartOutlined />, 'border-r-0')}
      {chartTypeButton(ChartType.PIE, <PieChartOutlined />, 'rounded-r-full')}
    </div>
  );

  const timeDivisionButton = (
    option: TimeDivisionOptions,
    extraStyle?: string,
  ) => {
    return (
      <div
        key={option}
        className={`flex font-medium px-3 border border-solid cursor-pointer h-fit py-0.5 ${
          timeDivision === option
            ? 'border-primary bg-primary text-white'
            : 'border-slate-200 text-slate-400 hover:bg-indigo-100'
        } ${extraStyle}`}
        onClick={() => {
          if (timeDivision !== option) {
            setTimeDivision(option);
          }
          if (onSelectTimeDivision) {
            onSelectTimeDivision(option);
          }
        }}
      >
        {option === 'DAY' ? 'Daily' : 'Hourly'}
      </div>
    );
  };

  const timeDivisionSelection = (
    <div className="flex items-center">
      {timeDivisionButton('HOUR', 'rounded-l-full border-r-0')}
      {timeDivisionButton('DAY', 'rounded-r-full')}
    </div>
  );

  const optionButton = (
    optionTitle: string,
    icon: ReactNode,
    onClick?: () => void,
  ) => (
    <div
      className="flex gap-2 items-center px-2 py-0.5 m-1 text-start rounded cursor-pointer text-slate-500 font-medium bg-white hover:bg-coop-lightblue-hover"
      onClick={() => {
        if (onClick) {
          onClick();
        }
        setOptionsVisible(false);
      }}
    >
      {icon}
      {optionTitle}
    </div>
  );

  const optionsMenu = (
    <div
      className={`relative inline-block self-center pl-2 ${
        narrowMode ? 'self-center xl:self-start' : 'self-center'
      }`}
      ref={optionsRef}
    >
      <div
        className={`${
          optionsVisible ? 'bg-slate-100' : ''
        } hover:bg-slate-100 text-slate-500 px-1 cursor-pointer rounded w-fit`}
        onClick={() => {
          setOptionsVisible((prev) => !prev);
        }}
      >
        <EllipsisOutlined className="flex text-2xl" />
      </div>
      <div
        className={`absolute right-0 z-30 mt-2 bg-white border border-solid rounded-md shadow-lg border-slate-200 ${
          optionsVisible ? 'visible' : 'hidden'
        }`}
      >
        {onEdit ? optionButton('Edit', <EditOutlined />, onEdit) : null}
        <CSVLink
          id="CSVLink"
          data={finalChartData}
          filename={`${title} (${timeWindow.start.toLocaleString()} - ${timeWindow.end.toLocaleString()})`}
          enclosingCharacter={`"`}
          target="_blank"
        >
          {optionButton('Download', <DownloadOutlined />)}
        </CSVLink>
        {onDelete ? optionButton('Delete', <DeleteOutlined />, onDelete) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`flex flex-col rounded-lg p-6 bg-white ${
        narrowMode ? 'flex flex-col justify-between grow' : 'w-full'
      } ${hideBorder ? '' : 'border border-solid border-slate-200'}`}
    >
      <div className="flex pb-6">
        <div
          className={`flex justify-between gap-2 grow ${
            narrowMode ? 'flex-row xl:flex-col' : 'flex-row'
          }`}
        >
          {title ? (
            <div className="flex flex-col text-start">
              <div className="pb-2 text-base font-medium text-slate-500">
                {title}
                {!hideGroupBy &&
                selectedGroupBy &&
                selectedGroupBy.length >= 1 &&
                !isCustomTitle
                  ? ` by ${selectedGroupBy
                      .map((x) => getDisplayNameForGroupByOption(x))
                      .join(', ')}`
                  : null}
                {infoText ? (
                  <AntTooltip
                    title={infoText}
                    placement="topRight"
                    color="white"
                  >
                    <InfoCircleOutlined className="pl-2 w-fit h-fit text-slate-300" />
                  </AntTooltip>
                ) : null}
              </div>
              {hideTotal ? null : (
                <div className="text-3xl font-semibold text-slate-900">
                  {dedupedQueryError ? (
                    'Unknown'
                  ) : dedupedQueryLoading ? (
                    <ComponentLoading />
                  ) : dedupedQueryData ? (
                    sumBy(
                      dedupedQueryData.getDecisionCounts,
                      'count',
                    ).toLocaleString()
                  ) : undefined}
                </div>
              )}
            </div>
          ) : null}
          <div
            className={`flex flex-wrap gap-4 ${
              narrowMode ? 'justify-end xl:justify-start' : 'justify-end'
            }`}
          >
            {timeDivisionSelection}
            {hideGroupBy ? null : (
              <ManualReviewDashboardInsightsGroupBy
                metric={metric}
                selectedGroupBy={selectedGroupBy}
                setSelectedGroupBy={onSetSelectedGroupBy}
              />
            )}
            {hideFilterBy ? null : (
              <ManualReviewDashboardInsightsFilterBy
                metric={metric}
                savedFilterBys={savedFilterBys}
                setSavedFilterBys={onSaveFilterBys}
                emptyFilterState={getEmptyFilterState(metric, timeWindow)}
                fixedGroupBy={hideGroupBy ? initialGroupBy : undefined}
              />
            )}
            {hideChartSelection ? null : chartSelection}
          </div>
        </div>
        {hideOptions ? null : optionsMenu}
      </div>
      <div className="z-10 flex flex-col w-full h-full min-h-[400px] pb-4">
        {!loading && finalChartData.length === 0 ? (
          emptyChart
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {loading ? (
              <ComponentLoading />
            ) : chartType === ChartType.PIE ? (
              pieChart
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
                {chartType === ChartType.LINE ? lineChart : barChart}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
