import {
  ArrowRightOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
} from '@ant-design/icons';
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
} from 'date-fns';
import React from 'react';
import { Link } from 'react-router-dom';

import ComponentLoading from '../../../../components/common/ComponentLoading';

import { TimeWindow } from '../../rules/dashboard/visualization/RulesDashboardInsights';

interface ManualReviewDashboardInsightsCardBaseProps {
  title: string;
  timeWindow: TimeWindow;
  icon: React.ReactNode;
  value: number | undefined;
  loading: boolean;
}

interface ManualReviewDashboardInsightsCardWithChangeProps
  extends ManualReviewDashboardInsightsCardBaseProps {
  change: number | undefined;
}

interface ManualReviewDashboardInsightsCardWithLinkProps
  extends ManualReviewDashboardInsightsCardBaseProps {
  link: string;
  linkTitle: string;
}

type ManualReviewDashboardInsightsCardProps =
  | ManualReviewDashboardInsightsCardWithChangeProps
  | ManualReviewDashboardInsightsCardWithLinkProps;

type TimeUnit = {
  getValue: (end: Date, start: Date) => number;
  singular: string;
  plural: string;
  threshold: number;
};

const timeUnits: TimeUnit[] = [
  {
    getValue: differenceInYears,
    singular: 'year',
    plural: 'years',
    threshold: 1,
  },
  {
    getValue: differenceInMonths,
    singular: 'month',
    plural: 'months',
    threshold: 1,
  },
  {
    getValue: differenceInWeeks,
    singular: 'week',
    plural: 'weeks',
    threshold: 1,
  },
  {
    getValue: differenceInDays,
    singular: 'day',
    plural: 'days',
    threshold: 1,
  },
  {
    getValue: differenceInHours,
    singular: 'hour',
    plural: 'hours',
    threshold: 1,
  },
  {
    getValue: differenceInMinutes,
    singular: 'minute',
    plural: 'minutes',
    threshold: 0,
  },
];

const getTimeWindowDescription = (window: TimeWindow): string => {
  const { start, end } = window;

  const unit = timeUnits.find(
    (unit) => unit.getValue(end, start) >= unit.threshold,
  );

  if (!unit) {
    return 'less than a minute';
  }

  const value = unit.getValue(end, start);
  return value === 1 ? unit.singular : `${value} ${unit.plural}`;
};

const ManualReviewDashboardInsightsCard = (
  props: ManualReviewDashboardInsightsCardProps,
) => {
  const { title, timeWindow, icon, value, loading } = props;

  // If there are decimals present, round to the nearest 10th
  const formatNumber = (n: number) => {
    return (n % 1 === 0 ? n : n.toFixed(1)).toLocaleString();
  };

  return (
    <div className="flex justify-between p-4 bg-white border border-solid rounded border-slate-200 grow">
      <div className="flex flex-col text-start">
        <div className="pb-6 text-base font-medium text-slate-500">{title}</div>
        {loading ? (
          <div className="self-start">
            <ComponentLoading />
          </div>
        ) : value != null ? (
          <div className="flex flex-col pb-2 text-3xl font-semibold text-slate-900">
            {formatNumber(value)}
            {'change' in props &&
            props.change !== undefined &&
            props.change !== Infinity &&
            !isNaN(props.change) ? (
              <div className="flex items-center gap-2">
                <div
                  className={`${
                    props.change === 0
                      ? 'text-slate-600 bg-slate-100'
                      : props.change < 0
                      ? 'text-red-600 bg-red-100'
                      : 'text-green-600 bg-green-100'
                  } p-1 rounded text-sm font-semibold flex items-center`}
                >
                  {props.change === 0 ? null : props.change < 0 ? (
                    <CaretDownOutlined />
                  ) : (
                    <CaretUpOutlined />
                  )}
                  {formatNumber(props.change)}%
                </div>
                <div className="text-sm font-medium text-slate-500">
                  vs. previous {getTimeWindowDescription(timeWindow)}
                </div>
              </div>
            ) : 'link' in props ? (
              <Link
                className="p-1 px-4 text-sm font-medium rounded cursor-pointer bg-coop-lightblue text-coop-blue hover:bg-coop-lightblue-hover w-fit"
                to={props.link}
              >
                {props.linkTitle}
                <ArrowRightOutlined className="pl-2" />
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="text-coop-alert-red">Error finding value</div>
        )}
      </div>
      <div className="pl-2 rounded">{icon}</div>
    </div>
  );
};

export default ManualReviewDashboardInsightsCard;
