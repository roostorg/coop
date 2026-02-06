import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import React, { useEffect, useRef, useState } from 'react';

import CloseButton from '@/components/common/CloseButton';

import {
  GQLDecisionCountGroupByColumns,
  GQLJobCountGroupByColumns,
  GQLJobCreationGroupByColumns,
} from '../../../../graphql/generated';
import { ManualReviewDashboardInsightsChartMetric } from './ManualReviewDashboardInsightsChart';

export type ManualReviewDashboardInsightsGroupByColumns =
  | GQLDecisionCountGroupByColumns
  | GQLJobCreationGroupByColumns
  | GQLJobCountGroupByColumns;

export function getDisplayNameForGroupByOption(
  option: ManualReviewDashboardInsightsGroupByColumns,
) {
  switch (option) {
    case GQLDecisionCountGroupByColumns.PolicyId:
    case GQLJobCreationGroupByColumns.PolicyId:
      return 'Policy';
    case GQLDecisionCountGroupByColumns.QueueId:
    case GQLJobCreationGroupByColumns.QueueId:
      return 'Queue';
    case GQLDecisionCountGroupByColumns.ReviewerId:
      return 'Moderator';
    case GQLDecisionCountGroupByColumns.Type:
      return 'Action';
    case GQLJobCreationGroupByColumns.ItemTypeId:
      return 'Item Type';
    case GQLJobCreationGroupByColumns.Source:
      return 'Source';
  }
}

export default function ManualReviewDashboardInsightsGroupBy(props: {
  metric: ManualReviewDashboardInsightsChartMetric;
  selectedGroupBy: ManualReviewDashboardInsightsGroupByColumns[] | undefined;
  setSelectedGroupBy: (
    groupBy: ManualReviewDashboardInsightsGroupByColumns[] | undefined,
  ) => void;
}) {
  const { metric, selectedGroupBy, setSelectedGroupBy } = props;
  const [groupByMenuVisible, setGroupByMenuVisible] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        componentRef.current &&
        !componentRef.current.contains(event.target as Node)
      ) {
        setGroupByMenuVisible(false);
      }
    };

    if (groupByMenuVisible) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [groupByMenuVisible]);

  const groupByMenuButton = (
    option: ManualReviewDashboardInsightsGroupByColumns,
  ) => {
    return (
      <div
        className={`px-2 py-0.5 m-1 text-start rounded cursor-pointer text-slate-500 font-medium ${
          selectedGroupBy?.includes(option)
            ? 'bg-coop-lightblue'
            : 'bg-white hover:bg-coop-lightblue-hover'
        }`}
        key={option}
        onClick={() => {
          setSelectedGroupBy([
            ...(selectedGroupBy ? selectedGroupBy : []),
            option,
          ]);
          setGroupByMenuVisible(false);
        }}
      >
        {getDisplayNameForGroupByOption(option)}
      </div>
    );
  };

  return (
    <div
      ref={componentRef}
      className="flex items-center self-center text-start"
    >
      <div className="pr-2 font-semibold text-slate-500 whitespace-nowrap">
        Group by
      </div>
      <div className="relative block float-left">
        <div
          onClick={() => setGroupByMenuVisible((visible) => !visible)}
          className="flex items-center px-2 py-1 border border-solid rounded cursor-pointer border-slate-200 hover:border-coop-blue"
        >
          {selectedGroupBy ? (
            selectedGroupBy.map((option) => (
              <div
                key={`groupByOptionPill-${option}`}
                className="flex gap-1.5 bg-slate-200 items-center py-0.5 px-2 font-medium text-slate-500 rounded whitespace-nowrap"
              >
                {getDisplayNameForGroupByOption(option)}
                <CloseButton
                  onClose={(event) => {
                    event.stopPropagation();
                    setSelectedGroupBy(
                      selectedGroupBy.filter((g) => g !== option),
                    );
                  }}
                />
              </div>
            ))
          ) : (
            <div className="text-slate-400 whitespace-nowrap">Select one</div>
          )}
          {/*
              We render both icons and toggle their visibility based on the groupByMenuVisible
              state instead of doing something like
              {groupByMenuVisible ? <ChevronUp /> : <ChevronDown />}
              because componentRef.current.contains doesn't work properly with that setup. It must
              be something about the component literally not being in the component tree based on
              the groupByMenuVisible state, versus the implementation below where the components
              stay in the component tree no matter what, and they're just hidden/visible based on
              the groupByMenuVisible state.
           */}
          <ChevronUp
            className={`ml-2 w-3 fill-slate-400 flex items-center ${
              groupByMenuVisible ? 'visible' : 'hidden'
            }`}
          />
          <ChevronDown
            className={`ml-2 w-3 fill-slate-400 flex items-center ${
              groupByMenuVisible ? 'hidden' : 'visible'
            }`}
          />
        </div>
        {groupByMenuVisible && (
          <div className="flex flex-col bg-white absolute border border-solid rounded shadow mt-1 p-2 min-w-[180px] z-20 border-slate-200">
            {Object.values(
              metric === 'DECISIONS'
                ? GQLDecisionCountGroupByColumns
                : GQLJobCreationGroupByColumns,
            ).map((option) => groupByMenuButton(option))}
          </div>
        )}
      </div>
    </div>
  );
}
