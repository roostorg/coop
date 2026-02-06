import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import { DatePicker, Select } from 'antd';
import without from 'lodash/without';
import moment from 'moment';
import { useRef, useState } from 'react';

import ComponentLoading from '../../../components/common/ComponentLoading';
import { selectFilterByLabelOption } from '../components/antDesignUtils';
import CoopButton from '../components/CoopButton';
import CloseButton from '@/components/common/CloseButton';

import {
  GQLManualReviewDecisionType,
  GQLRecentDecisionsFilterInput,
  useGQLManualReviewDecisionInsightsFilterByInfoQuery,
} from '../../../graphql/generated';
import { filterNullOrUndefined } from '../../../utils/collections';
import { safePick } from '../../../utils/misc';
import { JsonOf, jsonStringify } from '../../../utils/typescript-types';

const { Option } = Select;
const { RangePicker } = DatePicker;

type GQLRecentDecisionsFilterByColumns = Omit<
  GQLRecentDecisionsFilterInput,
  'endTime' | 'startTime' | 'userSearchString'
>;
type GQLRecentDecisionsFilterByColumnName =
  keyof GQLRecentDecisionsFilterByColumns;

type FilterByColumnName = GQLRecentDecisionsFilterByColumnName | 'dateRange';

export type RecentDecisionsFilterInput = Omit<
  GQLRecentDecisionsFilterInput,
  'decisions'
> & {
  decisions?: JsonOf<DecisionOrAction>[];
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
};

export type DecisionOrAction =
  | {
      type: 'CUSTOM_ACTION';
      actionId: string;
    }
  | {
      type: 'REJECT_APPEAL' | 'ACCEPT_APPEAL';
      appealId: string;
      actionIds: string[];
    }
  | {
      type: Exclude<
        GQLManualReviewDecisionType,
        'CUSTOM_ACTION' | 'RELATED_ACTION' | 'REJECT_APPEAL' | 'ACCEPT_APPEAL'
      >;
    };

const decisionFilterByColumns = [
  'decisions',
  'policyIds',
  'queueIds',
  'reviewerIds',
  'dateRange',
] as const;

export const getReadableNameFromDecisionType = (
  type: Exclude<
    GQLManualReviewDecisionType,
    'CUSTOM_ACTION' | 'RELATED_ACTION'
  >,
) => {
  switch (type) {
    case 'IGNORE':
      return 'Ignore';
    case 'REJECT_APPEAL':
      return 'Reject Appeal';
    case 'ACCEPT_APPEAL':
      return 'Accept Appeal';
    case 'SUBMIT_NCMEC_REPORT':
      return 'Report to NCMEC';
    case 'TRANSFORM_JOB_AND_RECREATE_IN_QUEUE':
      return 'Move to Different Queue';
    case 'AUTOMATIC_CLOSE':
      return 'Closed Automatically';
  }
};

export default function ManualReviewRecentDecisionsFilter(props: {
  input: RecentDecisionsFilterInput;
  onSave: (input: RecentDecisionsFilterInput) => void;
}) {
  const { input, onSave } = props;
  const [filterByMenuVisible, setFilterByMenuVisible] = useState(false);
  const [expandedColumnNames, setExpandedColumnNames] = useState<
    FilterByColumnName[]
  >([]);
  const [unsavedFilterValues, setUnsavedFilterValues] =
    useState<RecentDecisionsFilterInput>(input);
  const componentRef = useRef<HTMLDivElement>(null);
  const { loading, error, data } =
    useGQLManualReviewDecisionInsightsFilterByInfoQuery();

  if (error) {
    throw error;
  }

  if (loading) {
    return <ComponentLoading />;
  }

  const toggleColumn = (column: FilterByColumnName) => {
    if (expandedColumnNames.includes(column)) {
      setExpandedColumnNames(without(expandedColumnNames, column));
    } else {
      setExpandedColumnNames([...expandedColumnNames, column]);
    }
  };

  const onSaveClicked = () => {
    setFilterByMenuVisible(false);
    onSave(unsavedFilterValues);
  };

  const onSetUnsavedFilterValue = (
    column: FilterByColumnName,
    ids: readonly string[],
  ) => {
    setUnsavedFilterValues({
      ...unsavedFilterValues,
      [column]: ids,
    });
  };

  const filterByColumnDisplayName = (column: FilterByColumnName) => {
    switch (column) {
      case 'decisions':
        return 'Decisions';
      case 'policyIds':
        return 'Policies';
      case 'queueIds':
        return 'Queues';
      case 'reviewerIds':
        return 'Moderators';
      case 'dateRange':
        return 'Date Range';
    }
  };

  const getDropdownOptions = (
    column: Exclude<FilterByColumnName, 'dateRange'>,
  ) => {
    switch (column) {
      case 'decisions':
        return filterNullOrUndefined(
          [
            data?.myOrg?.actions.map((action) => ({
              name: action.name,
              id: jsonStringify({
                type: 'CUSTOM_ACTION',
                actionId: action.id,
              }),
            })),
            Object.values(GQLManualReviewDecisionType).map((it) =>
              it === 'RELATED_ACTION' || it === 'CUSTOM_ACTION'
                ? undefined
                : {
                    id: jsonStringify({ type: it }),
                    name: getReadableNameFromDecisionType(it),
                  },
            ),
          ].flat(),
        );
      case 'policyIds':
        return data?.myOrg?.policies.map((policy) =>
          safePick(policy, ['id', 'name']),
        );
      case 'queueIds':
        return data?.myOrg?.mrtQueues.map((queue) =>
          safePick(queue, ['id', 'name']),
        );
      case 'reviewerIds':
        return data?.myOrg?.users.map((user) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
        }));
    }
  };

  const filterByMenuColumn = (
    column: Exclude<FilterByColumnName, 'dateRange'>,
  ) => {
    const value = unsavedFilterValues[column];
    return (
      <Select
        mode="multiple"
        className="w-full font-normal rounded"
        value={value}
        allowClear
        showSearch
        onChange={(ids) => onSetUnsavedFilterValue(column, ids)}
        onClick={(event) => event.stopPropagation()}
        dropdownMatchSelectWidth={false}
        filterOption={selectFilterByLabelOption}
      >
        {getDropdownOptions(column)?.map((option, i) => (
          <Option
            key={`${option.id}_${i}`}
            value={option.id}
            label={option.name}
          >
            {option.name}
          </Option>
        ))}
      </Select>
    );
  };

  const numberOfSavedFilters = Object.keys(input).length;

  return (
    <div className="flex items-center self-center text-start">
      <div className="pr-2 font-semibold text-slate-500 whitespace-nowrap">
        Filter by
      </div>
      <div className="relative block" ref={componentRef}>
        <div
          onClick={() => {
            setFilterByMenuVisible(!filterByMenuVisible);
          }}
          className="flex items-center px-3 py-1 bg-white border border-solid rounded cursor-pointer border-slate-200 hover:border-coop-blue whitespace-nowrap"
        >
          {numberOfSavedFilters === 0 ? (
            <div className="text-slate-400">Select any</div>
          ) : (
            <div className="flex p-1 bg-slate-200 items-center px-2 py-0.5 gap-1.5 font-medium text-slate-500">
              {numberOfSavedFilters > 1
                ? `${numberOfSavedFilters} Filters`
                : '1 Filter'}
              <CloseButton
                onClose={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  onSave({});
                  setUnsavedFilterValues({});
                  setExpandedColumnNames([]);
                }}
              />
            </div>
          )}
          {/* If we do something like {filterByMenuVisible ? <ChevronUp /> : <ChevronDown />},
            then for some reason the componentRef.current.contains() doesn't work. I think it has
            something to do with dynamically choosing whether to render each icon because when
            we render both and just hide one of them, componentRef.current.contains() works. */}
          <ChevronUp
            className={`ml-2 w-3 fill-slate-400 flex items-center ${
              filterByMenuVisible ? '' : 'hidden'
            }`}
          />
          <ChevronDown
            className={`ml-2 w-3 fill-slate-400 flex items-center ${
              filterByMenuVisible ? 'hidden' : ''
            }`}
          />
        </div>
        {filterByMenuVisible && (
          <div className="flex flex-col bg-white absolute border border-solid rounded shadow mt-1 min-w-[240px] z-20 border-slate-200 right-0">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center text-base font-semibold text-slate-700">
                Filter
              </div>
              <CoopButton title="Save" size="small" onClick={onSaveClicked} />
            </div>
            <div className="divider" />
            <div className="flex flex-col">
              {[...decisionFilterByColumns].map((column, index) => {
                const isExpanded = expandedColumnNames.includes(column);
                const columnComponent =
                  column === 'dateRange' ? (
                    <RangePicker
                      className="!min-w-[250px]"
                      placeholder={['Start', 'End']}
                      value={
                        unsavedFilterValues.dateRange
                          ? [
                              moment(unsavedFilterValues.dateRange.startDate),
                              moment(unsavedFilterValues.dateRange.endDate),
                            ]
                          : undefined
                      }
                      format="YYYY-MM-DD"
                      showTime={{ format: 'hh:mm a' }}
                      onChange={(dates) => {
                        setUnsavedFilterValues({
                          ...unsavedFilterValues,
                          dateRange: {
                            startDate:
                              dates && dates[0] ? dates[0].toDate() : undefined,
                            endDate:
                              dates && dates[1] ? dates[1].toDate() : undefined,
                          },
                        });
                      }}
                    />
                  ) : (
                    filterByMenuColumn(column)
                  );
                return (
                  <div
                    className={`flex flex-col ${
                      isExpanded ? 'bg-gray-100' : ''
                    }`}
                    key={column}
                  >
                    <div
                      className="flex items-center p-4 cursor-pointer"
                      onClick={(_) => toggleColumn(column)}
                      key={`${index}_column_cell`}
                    >
                      <div
                        className="mr-2 font-medium text-slate-500 text-start"
                        key={`${index}_column_name`}
                      >
                        {filterByColumnDisplayName(column)}
                      </div>
                      {/* If we do something like {filterByMenuVisible ? <ChevronUp /> : <ChevronDown />},
                        then for some reason the componentRef.current.contains() doesn't work. I think it has
                        something to do with dynamically choosing whether to render each icon because when
                        we render both and just hide one of them, componentRef.current.contains() works. */}
                      <ChevronUp
                        className={`font-bold w-3 fill-slate-400 ${
                          isExpanded ? '' : 'hidden'
                        }`}
                      />
                      <ChevronDown
                        className={`font-bold w-3 fill-slate-400 ${
                          isExpanded ? 'hidden' : ''
                        }`}
                      />
                    </div>
                    {isExpanded && (
                      <div
                        className="flex flex-col p-4 pt-0"
                        key={`${index}_content`}
                      >
                        {columnComponent}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
