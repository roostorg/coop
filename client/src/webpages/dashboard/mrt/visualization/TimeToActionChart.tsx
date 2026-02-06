import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Tooltip as AntTooltip } from 'antd';
import orderBy from 'lodash/orderBy';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  GQLTimeToActionFilterByInput,
  useGQLGetAverageTimeToReviewLazyQuery,
  useGQLManualReviewDecisionInsightsOrgInfoQuery,
} from '../../../../graphql/generated';
import { safePick } from '../../../../utils/misc';
import type { TimeDivisionOptions } from '../../overview/Overview';
import { chartColors } from '../../rules/dashboard/visualization/chartColors';
import { TimeWindow } from '../../rules/dashboard/visualization/RulesDashboardInsights';
import { ManualReviewDashboardInsightsGroupByColumns } from './ManualReviewDashboardInsightsGroupBy';

interface TimeToActionByQueueChartProps {
  timeWindow: TimeWindow;
  title?: string;
  isCustomTitle?: boolean;
  initialTimeDivision?: TimeDivisionOptions;
  initialFilterBy?: Partial<GQLTimeToActionFilterByInput>;
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
  onUpdateFilterBy?: (filterBy: GQLTimeToActionFilterByInput) => void;
  onSelectTimeDivision?: (timeDivision: TimeDivisionOptions) => void;
}

export function getEmptyFilterState(
  timeWindow: TimeWindow,
): GQLTimeToActionFilterByInput {
  return {
    itemTypeIds: [],
    queueIds: [],
    startDate: timeWindow.start,
    endDate: timeWindow.end,
  };
}

export default function TimeToActionByQueueChart({
  timeWindow,
  title,
  hideBorder = false,
  hideOptions = false,
  infoText,
  narrowMode = false,
  onEdit,
  onDelete,
}: TimeToActionByQueueChartProps) {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const [
    getTimeToReview,
    {
      loading: timeToReviewLoading,
      error: timeToReviewError,
      data: timeToReviewData,
    },
  ] = useGQLGetAverageTimeToReviewLazyQuery();

  const [timeToReview, loading, error] = [
    timeToReviewData?.getTimeToAction,
    timeToReviewLoading,
    timeToReviewError,
  ];

  useEffect(() => {
    getTimeToReview({
      variables: {
        input: {
          groupBy: ['QUEUE_ID'],
          filterBy: {
            startDate: timeWindow.start,
            endDate: timeWindow.end,
            itemTypeIds: [],
            queueIds: [],
          },
        },
      },
    });
  }, [getTimeToReview, timeWindow]);

  const { data: orgQueryData } =
    useGQLManualReviewDecisionInsightsOrgInfoQuery();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node)
      ) {
        setOptionsVisible(false);
      }
    };

    if (optionsVisible) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [optionsVisible]);

  const getQueueNameFromId = (queue_id: string | undefined) => {
    if (!queue_id) {
      return 'Other';
    }
    return (
      orgQueryData?.myOrg?.mrtQueues.find((it) => it.id === queue_id)?.name ??
      'Other'
    );
  };

  const formattedData = timeToReview?.map((it) => ({
    timeToAction: it.timeToAction
      ? Number((it.timeToAction / 60 / 60).toFixed(2))
      : 0,
    queue: getQueueNameFromId(it.queueId ?? undefined),
  }));

  const renderLegend = ({ payload }: { payload?: Payload[] }) => (
    <div className="flex flex-wrap gap-1 p-1 overflow-auto border border-solid rounded max-h-24 border-slate-200">
      {payload
        ?.filter((entry) => entry.type !== 'none')
        .map((entry, index) => (
          <div
            key={index}
            className="flex font-semibold cursor-pointer text-zinc-500 hover:opacity-70 items-center gap-1.5 text-start"
          >
            <div
              style={{
                backgroundColor: chartColors[index % chartColors.length],
              }}
              className="flex rounded-full h-4 w-4"
            />
            {entry.value}
          </div>
        ))}
    </div>
  );

  if (error) {
    return <div>Error fetching metrics for chart</div>;
  }

  const customTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (active && payload?.length) {
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

  const emptyChart = (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6 bg-indigo-100 rounded">
      <div className="text-xl">We didn't find any results for this query.</div>
      <CoopButton
        title="Reset Filters"
        onClick={() => getEmptyFilterState(timeWindow)}
        size="small"
      />
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
        onClick?.();
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
    >
      <div
        className={`${
          optionsVisible ? 'bg-slate-100' : ''
        } hover:bg-slate-100 text-slate-500 px-1 cursor-pointer rounded w-fit`}
        onClick={() => setOptionsVisible((prev) => !prev)}
      >
        <EllipsisOutlined className="flex text-2xl" />
      </div>
      {optionsVisible && (
        <div
          ref={optionsRef}
          className="absolute right-0 z-30 mt-2 bg-white border border-solid rounded-md shadow-lg border-slate-200"
        >
          {onEdit && optionButton('Edit', <EditOutlined />, onEdit)}
          {onDelete && optionButton('Delete', <DeleteOutlined />, onDelete)}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`flex flex-col rounded-lg p-6 ${
        narrowMode ? 'flex flex-col justify-between grow' : 'w-full'
      } ${hideBorder ? '' : 'border border-solid border-slate-200'}`}
    >
      <div className="flex pb-6">
        <div
          className={`flex justify-between gap-2 grow ${
            narrowMode ? 'flex-row xl:flex-col' : 'flex-row'
          }`}
        >
          {title && (
            <div className="flex flex-col text-start">
              <div className="pb-2 text-base font-medium text-slate-500">
                {title}
                {infoText && (
                  <AntTooltip
                    title={infoText}
                    placement="topRight"
                    color="white"
                  >
                    <InfoCircleOutlined className="pl-2 w-fit h-fit text-slate-300" />
                  </AntTooltip>
                )}
              </div>
            </div>
          )}
          <div
            className={`flex flex-wrap gap-4 ${
              narrowMode ? 'justify-end xl:justify-start' : 'justify-end'
            }`}
          />
        </div>
        {!hideOptions && optionsMenu}
      </div>
      <div className="z-10 flex flex-col w-full h-full min-h-[400px] pb-4">
        {!loading && formattedData?.length === 0 ? (
          emptyChart
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {loading ? (
              <ComponentLoading />
            ) : (
              <BarChart data={formattedData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="queue" tickLine={false} />
                <YAxis
                  tickLine={false}
                  stroke="#d4d4d8"
                  label={{
                    value: `Average Time in Review (hours)`,
                    style: { textAnchor: 'middle' },
                    angle: -90,
                    position: 'left',
                    offset: 0,
                  }}
                />
                <Legend
                  payload={formattedData?.map((it) => ({
                    value: it.queue,
                  }))}
                  content={renderLegend}
                />
                <Tooltip content={customTooltip} />
                <Bar
                  name={'Hours in Review'}
                  type="monotone"
                  dataKey={'timeToAction'}
                >
                  {formattedData?.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
