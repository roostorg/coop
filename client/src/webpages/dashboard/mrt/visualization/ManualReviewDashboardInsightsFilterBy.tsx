import { Label } from '@/coop-ui/Label';
import { Switch } from '@/coop-ui/Switch';
import { ReactComponent as ChevronDown } from '@/icons/lni/Direction/chevron-down.svg';
import { ReactComponent as ChevronUp } from '@/icons/lni/Direction/chevron-up.svg';
import { filterNullOrUndefined } from '@/utils/collections';
import { InfoCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Select, Tooltip } from 'antd';
import omit from 'lodash/omit';
import without from 'lodash/without';
import { useEffect, useRef, useState } from 'react';

import ComponentLoading from '../../../../components/common/ComponentLoading';
import { selectFilterByLabelOption } from '../../components/antDesignUtils';
import CoopButton from '../../components/CoopButton';
import CloseButton from '@/components/common/CloseButton';

import {
  GQLDecisionCountFilterByInput,
  GQLDecisionCountGroupByColumns,
  GQLJobCountFilterByInput,
  GQLJobCreationFilterByInput,
  GQLJobCreationGroupByColumns,
  GQLJobCreationSourceOptions,
  useGQLManualReviewDecisionInsightsFilterByInfoQuery,
  type GQLGetSkippedJobCountInput,
  type GQLSkippedJobFilterByInput,
} from '../../../../graphql/generated';
import { safePick } from '../../../../utils/misc';
import { ManualReviewDashboardInsightsChartMetric } from './ManualReviewDashboardInsightsChart';
import { ManualReviewDashboardInsightsGroupByColumns } from './ManualReviewDashboardInsightsGroupBy';

const { Option } = Select;

type GQLDecisionCountFilterByColumns = Omit<
  GQLDecisionCountFilterByInput,
  'startDate' | 'endDate' | 'type'
>;
type GQLDecisionCountFilterByColumnName = keyof GQLDecisionCountFilterByColumns;
type GQLJobCreationFilterByColumns = Omit<
  GQLJobCreationFilterByInput,
  'startDate' | 'endDate'
>;
type GQLJobCreationFilterByColumnName = keyof GQLJobCreationFilterByColumns;

type GQLJobCountFilterByColumns = Omit<
  GQLJobCountFilterByInput,
  'startDate' | 'endDate'
>;
type GQLJobCountFilterByColumnName = keyof GQLJobCountFilterByColumns;

type GQLSkippedJobCountFilterByColumns = Omit<
  GQLSkippedJobFilterByInput,
  'startDate' | 'endDate'
>;
type GQLSkippedJobCountFilterByColumnName =
  keyof GQLSkippedJobCountFilterByColumns;

type FilterByColumnName =
  | GQLDecisionCountFilterByColumnName
  | GQLJobCreationFilterByColumnName
  | GQLJobCountFilterByColumnName
  | GQLSkippedJobCountFilterByColumnName;

const decisionFilterByColumns = [
  'actionIds',
  'itemTypeIds',
  'policyIds',
  'queueIds',
  'reviewerIds',
  'filteredDecisionActionType',
] as const satisfies readonly (keyof GQLDecisionCountFilterByColumns)[];
const jobCreationFilterColumns = [
  'policyIds',
  'queueIds',
  'itemTypeIds',
  'sources',
  'ruleIds',
] as const satisfies readonly (keyof GQLJobCreationFilterByColumns)[];
const jobCountFilterColumns = [
  'queueIds',
  'reviewerIds',
] as const satisfies readonly (keyof GQLJobCountFilterByColumns)[];
const skippedJobCountFilterColumns = [
  'queueIds',
  'reviewerIds',
] as const satisfies readonly (keyof GQLSkippedJobCountFilterByColumns)[];

export function groupByColumnToFilterByColumns(
  groupBy: ManualReviewDashboardInsightsGroupByColumns[],
): FilterByColumnName[] {
  return groupBy.flatMap((groupByColumn) => {
    return (() => {
      switch (groupByColumn) {
        case GQLDecisionCountGroupByColumns.PolicyId:
        case GQLJobCreationGroupByColumns.PolicyId:
          return ['policyIds'];
        case GQLDecisionCountGroupByColumns.QueueId:
        case GQLJobCreationGroupByColumns.QueueId:
          return ['queueIds'];
        case GQLDecisionCountGroupByColumns.ReviewerId:
          return ['reviewerIds'];
        case GQLDecisionCountGroupByColumns.Type:
          return ['actionIds'];
        case GQLJobCreationGroupByColumns.ItemTypeId:
          return ['itemTypeIds'];
        case GQLJobCreationGroupByColumns.Source:
          return ['sources', 'ruleIds'];
      }
    })() as FilterByColumnName[];
  });
}

export type ManualReviewDashboardInsightsFilterByInput =
  | GQLDecisionCountFilterByInput
  | GQLJobCreationFilterByInput
  | GQLJobCountFilterByInput
  | GQLGetSkippedJobCountInput;

gql`
  query ManualReviewDecisionInsightsFilterByInfo {
    myOrg {
      actions {
        ... on ActionBase {
          id
          name
        }
      }
      itemTypes {
        ... on ItemTypeBase {
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
      rules {
        ... on Rule {
          id
          name
        }
      }
    }
  }
`;

export default function ManualReviewDashboardInsightsFilterBy(props: {
  metric: ManualReviewDashboardInsightsChartMetric;
  savedFilterBys: ManualReviewDashboardInsightsFilterByInput;
  setSavedFilterBys: (
    filterBys: ManualReviewDashboardInsightsFilterByInput,
  ) => void;
  emptyFilterState: ManualReviewDashboardInsightsFilterByInput;
  fixedGroupBy?: ManualReviewDashboardInsightsGroupByColumns[] | undefined;
}) {
  const {
    metric,
    savedFilterBys,
    setSavedFilterBys,
    emptyFilterState,
    fixedGroupBy,
  } = props;
  const [filterByMenuVisible, setFilterByMenuVisible] = useState(false);
  const [expandedColumnNames, setExpandedColumnNames] = useState<
    FilterByColumnName[]
  >([]);
  const [unsavedFilterValues, setUnsavedFilterValues] =
    useState<ManualReviewDashboardInsightsFilterByInput>(savedFilterBys);
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
    if (column === 'actionIds') {
      setUnsavedFilterValues({
        ...unsavedFilterValues,
        type: filterNullOrUndefined(
          ids.map((id) =>
            id === 'IGNORE'
              ? 'IGNORE'
              : id === 'SUBMIT_NCMEC_REPORT'
              ? 'SUBMIT_NCMEC_REPORT'
              : undefined,
          ),
        ),
        actionIds: filterNullOrUndefined(
          ids.map((id) =>
            id === 'IGNORE'
              ? undefined
              : id === 'SUBMIT_NCMEC_REPORT'
              ? undefined
              : id,
          ),
        ),
      });
    } else {
      setUnsavedFilterValues({
        ...unsavedFilterValues,
        [column]: ids,
      });
    }
  };

  const filterByColumnDisplayName = (column: FilterByColumnName) => {
    switch (column) {
      case 'actionIds':
        return 'Actions';
      case 'itemTypeIds':
        return 'Item Types';
      case 'policyIds':
        return 'Policies';
      case 'queueIds':
        return 'Queues';
      case 'reviewerIds':
        return 'Moderators';
      case 'sources':
        return 'Sources';
      case 'ruleIds':
        return 'Rules';
      case 'filteredDecisionActionType':
        return 'Action Type';
    }
  };

  const getDropdownOptions = (
    column: Exclude<FilterByColumnName, 'filteredDecisionActionType'>,
  ) => {
    switch (column) {
      case 'actionIds':
        return [
          ...(data?.myOrg?.actions.map((action) =>
            safePick(action, ['id', 'name']),
          ) ?? []),
          { id: 'IGNORE', name: 'Ignore' },
          { id: 'SUBMIT_NCMEC_REPORT', name: 'Submit to NCMEC' },
        ];
      case 'itemTypeIds':
        return data?.myOrg?.itemTypes.map((itemType) =>
          safePick(itemType, ['id', 'name']),
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
      case 'sources':
        return [
          { id: GQLJobCreationSourceOptions.RuleExecution, name: 'Rules' },
          { id: GQLJobCreationSourceOptions.Report, name: 'User Reports' },
          {
            id: GQLJobCreationSourceOptions.MrtJob,
            name: 'Moderator Escalation',
          },
        ];
      case 'ruleIds':
        return data?.myOrg?.rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
        }));
    }
  };

  const filteredDecisionActionTypeColumn = (
    <div className="flex row">
      <div className="flex items-center space-x-2">
        <Switch
          id="filtered-decision-action-type"
          checked={Boolean(
            'filteredDecisionActionType' in unsavedFilterValues
              ? unsavedFilterValues.filteredDecisionActionType?.includes(
                  'RELATED_ACTION',
                )
              : false,
          )}
          onCheckedChange={(isChecked) => {
            setUnsavedFilterValues({
              ...unsavedFilterValues,
              filteredDecisionActionType: isChecked ? ['RELATED_ACTION'] : [],
            });
          }}
        />
        <Label htmlFor="filtered-decision-action-type">
          Primary Actions Only
        </Label>
      </div>
      <Tooltip
        className="pl-2"
        placement="right"
        title={`A "Primary Action" is the main decision associated with each job. Including only Primary Actions will filter out other actions that were taken on surrounding context in the job. For example, if a user is reported, and your main decision is to ignore the report rather than penalizing the user, then your “Primary Action” will be “Ignore”. But if you deleted one of the user’s posts because you saw it in the job, that would be a related action, not a Primary Action. `}
      >
        <InfoCircleOutlined className="text-slate-500" />
      </Tooltip>
    </div>
  );

  const filterByMenuColumn = (
    column: Exclude<FilterByColumnName, 'filteredDecisionActionType'>,
  ) => {
    const value =
      'sources' in unsavedFilterValues
        ? unsavedFilterValues[column as GQLJobCreationFilterByColumnName]
        : 'actionIds' in unsavedFilterValues
        ? [
            ...(unsavedFilterValues[
              column as GQLDecisionCountFilterByColumnName
            ] ?? []),
            ...(unsavedFilterValues.type ?? []),
          ]
        : metric === 'REVIEWED_JOBS' && 'reviewerIds' in unsavedFilterValues
        ? unsavedFilterValues[column as GQLJobCountFilterByColumnName]
        : metric === 'SKIPPED_JOBS' && 'reviewerIds' in unsavedFilterValues
        ? unsavedFilterValues[column as GQLSkippedJobCountFilterByColumnName]
        : [];

    return (
      <Select
        mode="multiple"
        className="w-full font-normal rounded"
        value={value}
        allowClear
        showSearch
        filterOption={selectFilterByLabelOption}
        onChange={(ids) => onSetUnsavedFilterValue(column, ids)}
        onClick={(event) => event.stopPropagation()}
        dropdownMatchSelectWidth={false}
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
    <div className="flex items-center self-center text-start">
      <div className="pr-2 font-semibold text-slate-500 whitespace-nowrap">
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
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center text-base font-semibold text-slate-700">
                Filter
              </div>
              <CoopButton title="Save" size="small" onClick={onSave} />
            </div>
            <div className="divider" />
            <div className="flex flex-col">
              {(() => {
                switch (metric) {
                  case 'DECISIONS':
                    return [...decisionFilterByColumns].filter(
                      (it) =>
                        fixedGroupBy === undefined ||
                        groupByColumnToFilterByColumns(fixedGroupBy).includes(
                          it,
                        ),
                    );
                  case 'JOBS':
                    return [...jobCreationFilterColumns].filter(
                      (it) =>
                        fixedGroupBy === undefined ||
                        groupByColumnToFilterByColumns(fixedGroupBy).includes(
                          it,
                        ),
                    );
                  case 'REVIEWED_JOBS':
                    return jobCountFilterColumns;
                  case 'SKIPPED_JOBS':
                    return skippedJobCountFilterColumns;
                }
              })()
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
                        {/* If we do something like {filterByMenuVisible ? <UpOutlined /> : <DownOutlined />},
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
                          {column === 'filteredDecisionActionType'
                            ? filteredDecisionActionTypeColumn
                            : filterByMenuColumn(column)}
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
