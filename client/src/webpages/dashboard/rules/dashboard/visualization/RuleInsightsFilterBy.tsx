import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import { Select } from 'antd';
import omit from 'lodash/omit';
import without from 'lodash/without';
import { useEffect, useRef, useState } from 'react';

import ComponentLoading from '../../../../../components/common/ComponentLoading';
import CloseButton from '@/components/common/CloseButton';
import { selectFilterByLabelOption } from '@/webpages/dashboard/components/antDesignUtils';
import CoopButton from '@/webpages/dashboard/components/CoopButton';

import {
  GQLActionSource,
  GQLActionStatisticsFilters,
  GQLActionStatisticsGroupByColumns,
  useGQLManualReviewDecisionInsightsFilterByInfoQuery,
} from '../../../../../graphql/generated';
import { safePick } from '../../../../../utils/misc';

const { Option } = Select;

type GQLActionStatisticsFilterByColumns = Omit<
  GQLActionStatisticsFilters,
  'startDate' | 'endDate'
>;
type GQLActionStatisticsFilterByColumnName =
  keyof GQLActionStatisticsFilterByColumns;

type FilterByColumnName = GQLActionStatisticsFilterByColumnName;

const actionStatisiticsFilterByColumns = [
  'actionIds',
  'itemTypeIds',
  'policyIds',
  'ruleIds',
  'sources',
] as const satisfies readonly (keyof GQLActionStatisticsFilterByColumns)[];

export function groupByColumnToFilterByColumns(
  groupBy: GQLActionStatisticsGroupByColumns,
): FilterByColumnName[] {
  switch (groupBy) {
    case GQLActionStatisticsGroupByColumns.RuleId:
      return ['ruleIds'];
    case GQLActionStatisticsGroupByColumns.ActionId:
      return ['actionIds'];
    case GQLActionStatisticsGroupByColumns.ItemTypeId:
      return ['itemTypeIds'];
    case GQLActionStatisticsGroupByColumns.ActionSource:
      return ['sources'];
    case GQLActionStatisticsGroupByColumns.PolicyId:
      return ['policyIds'];
  }
}

export type RuleInsightsFilterByColumns = GQLActionStatisticsFilters;

export default function RuleInsightsFilterBy(props: {
  savedFilterBys: GQLActionStatisticsFilters;
  setSavedFilterBys: (filterBys: GQLActionStatisticsFilters) => void;
  emptyFilterState: GQLActionStatisticsFilters;
  fixedGroupBy?: GQLActionStatisticsGroupByColumns | undefined;
}) {
  const { savedFilterBys, setSavedFilterBys, emptyFilterState, fixedGroupBy } =
    props;
  const [filterByMenuVisible, setFilterByMenuVisible] = useState(false);
  const [expandedColumnNames, setExpandedColumnNames] = useState<
    FilterByColumnName[]
  >([]);
  const [unsavedFilterValues, setUnsavedFilterValues] =
    useState<GQLActionStatisticsFilters>(savedFilterBys);
  const componentRef = useRef<HTMLDivElement>(null);
  const { loading, error, data } =
    useGQLManualReviewDecisionInsightsFilterByInfoQuery();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        componentRef.current &&
        !componentRef.current.contains(event.target as Node)
      ) {
        if (filterByMenuVisible) {
          setFilterByMenuVisible(false);
        }
      }
    };

    if (filterByMenuVisible) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [filterByMenuVisible]);

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

  const onSave = () => {
    setSavedFilterBys(unsavedFilterValues);
    setFilterByMenuVisible(false);
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
      case 'ruleIds':
        return 'Rules';
      case 'actionIds':
        return 'Actions';
      case 'itemTypeIds':
        return 'Item Types';
      case 'policyIds':
        return 'Policies';
      case 'sources':
        return 'Sources';
    }
  };

  const getDropdownOptions = (
    column: Exclude<FilterByColumnName, 'filteredDecisionActionType'>,
  ) => {
    switch (column) {
      case 'actionIds':
        return data?.myOrg?.actions.map((action) =>
          safePick(action, ['id', 'name']),
        );
      case 'ruleIds':
        return data?.myOrg?.rules.map((rule) => safePick(rule, ['id', 'name']));
      case 'itemTypeIds':
        return data?.myOrg?.itemTypes.map((itemType) =>
          safePick(itemType, ['id', 'name']),
        );
      case 'policyIds':
        return data?.myOrg?.policies.map((policy) =>
          safePick(policy, ['id', 'name']),
        );
      case 'sources':
        return [
          { id: GQLActionSource.AutomatedRule, name: 'Rule Execution' },
          { id: GQLActionSource.ManualActionRun, name: 'Manual Action' },
          {
            id: GQLActionSource.MrtDecision,
            name: 'Moderator Decision',
          },
          {
            id: GQLActionSource.PostActions,
            name: 'Actions Endpoint',
          },
        ];
    }
  };

  const filterByMenuColumn = (
    column: Exclude<FilterByColumnName, 'filteredDecisionActionType'>,
  ) => {
    const value = unsavedFilterValues[column];
    return (
      <Select
        mode="multiple"
        className="w-full font-normal rounded"
        value={value}
        onChange={(ids) => onSetUnsavedFilterValue(column, ids)}
        onClick={(event) => event.stopPropagation()}
        dropdownMatchSelectWidth={false}
        allowClear
        showSearch
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

  const numberOfSavedFilters = Object.values(
    omit(savedFilterBys, ['startDate', 'endDate']),
  ).flat().length;

  return (
    <div className="flex flex-col items-start self-center gap-1 text-start">
      <div className="pr-2 text-sm font-semibold text-slate-500 whitespace-nowrap">
        Filter by
      </div>
      <div className="relative block" ref={componentRef}>
        <div
          onClick={() => {
            setFilterByMenuVisible(!filterByMenuVisible);
          }}
          className="flex items-center px-3 py-1 border border-solid rounded cursor-pointer border-slate-200 hover:border-coop-blue whitespace-nowrap"
        >
          {numberOfSavedFilters > 0 ? (
            <div className="flex p-1 bg-slate-200 items-center px-2 py-0.5 gap-1.5 font-medium text-slate-500">
              {numberOfSavedFilters > 1
                ? `${numberOfSavedFilters} Filters`
                : '1 Filter'}
              <CloseButton
                onClose={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  setSavedFilterBys(emptyFilterState);
                  setUnsavedFilterValues(emptyFilterState);
                  setExpandedColumnNames([]);
                }}
              />
            </div>
          ) : (
            <div className="text-slate-400">Select any</div>
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
            <div className="flex justify-between px-4 py-4">
              <div className="flex items-center text-base font-semibold text-slate-700">
                Filter
              </div>
              <CoopButton title="Save" size="small" onClick={onSave} />
            </div>
            <div className="divider" />
            <div className="flex flex-col">
              {[...actionStatisiticsFilterByColumns]
                .filter(
                  (it) =>
                    fixedGroupBy === undefined ||
                    groupByColumnToFilterByColumns(fixedGroupBy).includes(it),
                )
                // If there's a fixedGroupBy, the only filter option should be the same column.
                // For example, in a "Decisions by Moderator" chart, users should only be
                // able to filter by Moderator
                .map((column, index) => {
                  const isExpanded = expandedColumnNames.includes(column);
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
                          {filterByMenuColumn(column)}
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
