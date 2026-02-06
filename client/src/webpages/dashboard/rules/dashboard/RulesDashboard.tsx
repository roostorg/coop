import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/coop-ui/Select';
import { AuditOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import capitalize from 'lodash/capitalize';
import groupBy from 'lodash/groupBy';
import lowerCase from 'lodash/lowerCase';
import moment from 'moment';
import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Column, Row } from 'react-table';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopButton from '../../components/CoopButton';
import CoopModal from '../../components/CoopModal';
import DashboardHeader from '../../components/DashboardHeader';
import EmptyDashboard from '../../components/EmptyDashboard';
import RoundedTag from '../../components/RoundedTag';
import RowMutations, {
  DeleteRowModalInfo,
} from '../../components/RowMutations';
import TabBar from '../../components/TabBar';
import {
  ColumnProps,
  DateRangeColumnFilter,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../../components/table/filters';
import { ruleStatusSort, stringSort } from '../../components/table/sort';
import Table from '../../components/table/Table';
import TruncatedListTableCell from '../../components/table/TruncatedListTableCell';
import TruncatedTextTableCell from '../../components/table/TruncatedTextTableCell';
import UserWithAvatar from '../../components/UserWithAvatar';

import {
  GQLRuleStatus,
  GQLSignalType,
  GQLUserPermission,
  useGQLAddFavoriteRuleMutation,
  useGQLDeleteRuleMutation,
  useGQLRemoveFavoriteRuleMutation,
  useGQLRulesQuery,
} from '../../../../graphql/generated';
import { userHasPermissions } from '../../../../routing/permissions';
import {
  getEarliestDateWithLookback,
  LookbackLength,
} from '../../../../utils/time';
import {
  getDisplayNameForTimeDivision,
  TimeDivisionOption,
  type TimeDivisionOptions,
} from '../../overview/Overview';
import RuleDashboardInsightsChart from './visualization/rulesDashboardInsightsChart';

const RULE_FIELDS_FRAGMENT = gql`
  fragment RulesDashboardRuleFieldsFragment on Rule {
    id
    name
    creator {
      firstName
      lastName
    }
    createdAt
    updatedAt
    status
    policies {
      name
    }
    actions {
      ... on ActionBase {
        id
        name
      }
    }
  }
`;

export const RULES_QUERY = gql`
  ${RULE_FIELDS_FRAGMENT}
  query Rules {
    myOrg {
      id
      name
      rules {
        conditionSet {
          ...ConditionSetFields
        }
        ... on ContentRule {
          ...RulesDashboardRuleFieldsFragment
          itemTypes {
            ... on ItemTypeBase {
              id
              name
            }
          }
        }
        ... on UserRule {
          ...RulesDashboardRuleFieldsFragment
        }
      }
    }
    me {
      permissions
      favoriteRules {
        id
      }
    }
  }
`;

export const DELETE_RULE_MUTATION = gql`
  mutation DeleteRule($id: ID!) {
    deleteRule(id: $id)
  }
`;

gql`
  mutation AddFavoriteRule($ruleId: ID!) {
    addFavoriteRule(ruleId: $ruleId) {
      ... on AddFavoriteRuleSuccessResponse {
        _
      }
    }
  }

  mutation RemoveFavoriteRule($ruleId: ID!) {
    removeFavoriteRule(ruleId: $ruleId) {
      ... on RemoveFavoriteRuleSuccessResponse {
        _
      }
    }
  }
`;

export function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case GQLRuleStatus.Live:
      return '#4BB543';
    case GQLRuleStatus.Background:
      return '#3591d7';
    case GQLRuleStatus.Expired:
      return '#EE5E67';
    case GQLRuleStatus.Archived:
      return '#A5A6F6';
    case GQLRuleStatus.Draft:
    default:
      return '#B5B2B0';
  }
}

type RuleTableMode = 'active' | 'archived';

/**
 * Rules Dashboard screen
 */
export default function RulesDashboard() {
  const { data, error, loading, refetch } = useGQLRulesQuery({
    fetchPolicy: 'network-only',
  });
  // Need to create a copy of the rules array because sort
  // modifies the variable, and the GraphQL response is read-only
  const rules = data?.myOrg?.rules?.filter((it) => {
    const allLeafConditions = it.conditionSet.conditions.filter(
      (it) => it.__typename === 'LeafCondition',
    );
    return !allLeafConditions
      .map((it) => 'signal' in it && it.signal?.type)
      .includes(GQLSignalType.Aggregation);
  });

  const [deleteRule] = useGQLDeleteRuleMutation({
    onCompleted: async () => refetch(),
  });
  const [addFavoriteRule] = useGQLAddFavoriteRuleMutation({
    onCompleted: async () => refetch(),
  });
  const [removeFavoriteRule] = useGQLRemoveFavoriteRuleMutation({
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);
  const [ruleTableMode, setRuleTableMode] = useState<RuleTableMode>('active');
  const navigate = useNavigate();
  const [timeDivision, setTimeDivision] = useState<TimeDivisionOptions>('DAY');

  const rowLinkTo = (row: Row<any>) => {
    return `info/${row.original.values.id}`;
  };

  const permissions = data?.me?.permissions;
  const favoritedRules = data?.me?.favoriteRules.map((rule) => rule?.id);
  const canEditLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateLiveRules,
  ]);
  const canEditNonLiveRules = userHasPermissions(permissions, [
    GQLUserPermission.MutateNonLiveRules,
  ]);

  const editRule = useCallback(
    (id: string, event: MouseEvent) => {
      // This ensures that the row's link isn't followed because
      // the row is the parent component
      event.preventDefault();
      if (rules == null) {
        return;
      }
      const selectedRule = rules.find((rule) => rule.id === id);
      if (selectedRule) {
        navigate(`form/${id}`);
      }
    },
    [navigate, rules],
  );

  const onDeleteRule = (id: string) => {
    deleteRule({
      variables: { id },
      refetchQueries: [{ query: RULES_QUERY }],
    });
  };
  const onAddFavoriteRule = useCallback(
    (ruleId: string, event: MouseEvent) => {
      event.stopPropagation();
      addFavoriteRule({
        variables: {
          ruleId,
        },
        refetchQueries: [{ query: RULES_QUERY }],
      });
    },
    [addFavoriteRule],
  );
  const onRemoveFavoriteRule = useCallback(
    (ruleId: string, event: MouseEvent) => {
      event.stopPropagation();
      removeFavoriteRule({
        variables: {
          ruleId,
        },
        refetchQueries: [{ query: RULES_QUERY }],
      });
    },
    [removeFavoriteRule],
  );

  const showDeleteModal = useCallback((id: string, event: MouseEvent) => {
    // This ensures that the row's link isn't followed because
    // the row is the parent component
    event.preventDefault();
    setModalInfo({
      id,
      visible: true,
    });
  }, []);

  const mutations = useCallback(
    (id: string) => {
      return (
        <RowMutations
          onEdit={(event: MouseEvent) => editRule(id, event)}
          onDelete={(event: MouseEvent) => showDeleteModal(id, event)}
          canDelete={
            (canEditNonLiveRules &&
              rules?.find((it) => it.id === id)?.status !==
                GQLRuleStatus.Live) ||
            canEditLiveRules
          }
          deleteDisabledTooltipTitle="To delete Live Rules, ask your organization's admin to upgrade your role to Rules Manager or Admin."
        />
      );
    },
    [rules, canEditLiveRules, canEditNonLiveRules, editRule, showDeleteModal],
  );

  const columns = useMemo(
    () =>
      [
        {
          Header: '',
          accessor: 'favoriteRules',
          canSort: false,
        },
        {
          Header: 'Created',
          accessor: 'dateCreated',
          Filter: (props: ColumnProps) =>
            DateRangeColumnFilter({
              columnProps: props,
              accessor: 'dateCreated',
            }),
          filter: 'dateRange',
          sortDescFirst: true,
          sortType: stringSort,
        },
        {
          Header: 'Rule',
          accessor: 'name',
          Filter: (props: ColumnProps) =>
            DefaultColumnFilter({
              columnProps: props,
              accessor: 'name',
            }),
          filter: 'text',
          sortType: stringSort,
        },
        {
          Header: 'Owner',
          accessor: 'owner',
          Filter: (props: ColumnProps) =>
            SelectColumnFilter({
              columnProps: props,
              accessor: 'owner',
            }),
          filter: 'includes',
          canSort: false,
        },
        {
          Header: 'Status',
          accessor: 'status',
          Filter: (props: ColumnProps) =>
            SelectColumnFilter({
              columnProps: props,
              accessor: 'status',
            }),
          filter: 'includes',
          sortType: ruleStatusSort,
        },
        {
          Header: 'Policies',
          accessor: 'policies',
          Filter: (props: ColumnProps) =>
            SelectColumnFilter({
              columnProps: props,
              accessor: 'policies',
            }),
          filter: 'includes',
          canSort: false,
        },
        {
          Header: 'Item Types',
          accessor: 'itemTypes',
          Filter: (props: ColumnProps) =>
            SelectColumnFilter({
              columnProps: props,
              accessor: 'itemTypes',
            }),
          filter: 'includes',
          canSort: false,
        },
        {
          Header: '',
          accessor: 'mutations',
          canSort: false,
        },
      ] as (Column<object> & { canSort?: boolean })[],
    [],
  );

  const rulesByStatus = groupBy(rules, (rule) =>
    rule.status === 'ARCHIVED' ? 'archived' : 'active',
  );

  const dataValues = useMemo(
    () =>
      (rulesByStatus[ruleTableMode] ?? []).map((rule) => {
        return {
          id: rule.id,
          name: rule.name,
          owner: `${rule.creator.firstName} ${rule.creator.lastName}`,
          dateCreated: new Date(Number(rule.createdAt))
            .toISOString()
            .substring(0, 10),
          status: rule.status,
          policies: rule.policies.map((it) => it.name),
          itemTypes:
            rule.__typename === 'ContentRule'
              ? rule.itemTypes.map((itemType) => itemType.name)
              : [],
          isFavorited: favoritedRules?.includes(rule.id),
        };
      }),
    [rulesByStatus, ruleTableMode, favoritedRules],
  );

  const tableData = useMemo(
    () =>
      dataValues
        ?.slice()
        ?.sort((a, b) => {
          if (a.status === 'EXPIRED' && b.status !== 'EXPIRED') {
            return 1;
          } else if (a.status !== 'EXPIRED' && b.status === 'EXPIRED') {
            return -1;
          }

          if (a.isFavorited && !b.isFavorited) {
            return -1;
          }
          if (b.isFavorited && !a.isFavorited) {
            return 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map((values) => {
          return {
            mutations: mutations(values.id),
            name: (
              <div className="w-80">
                <TruncatedTextTableCell text={values.name} />
              </div>
            ),
            owner: <UserWithAvatar name={values.owner} />,
            dateCreated: (
              <div className="flex shrink-0">{values.dateCreated}</div>
            ),
            status: (
              <div className="flex items-center">
                <RoundedTag
                  title={capitalize(lowerCase(values.status))}
                  status={values.status}
                />
              </div>
            ),
            policies: (
              <div className="w-48">
                <TruncatedListTableCell list={values.policies} />
              </div>
            ),
            itemTypes: (
              <div className="w-48">
                <TruncatedListTableCell list={values.itemTypes} />
              </div>
            ),
            favoriteRules: (
              <div className="relative w-5 h-5">
                <StarFilled
                  className={`cursor-pointer absolute top-0 left-0 text-xl !text-[#faad14] ${
                    values.isFavorited ? '' : 'invisible'
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onRemoveFavoriteRule(values.id, event);
                  }}
                />
                <StarOutlined
                  className={`cursor-pointer absolute top-0 left-0 text-xl !text-[#faad14] ${
                    values.isFavorited ? 'invisible' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onAddFavoriteRule(values.id, event);
                  }}
                />
              </div>
            ),
            values,
          };
        }),
    [mutations, dataValues, onAddFavoriteRule, onRemoveFavoriteRule],
  );

  if (error) {
    throw error;
  }

  if (loading) {
    return <FullScreenLoading />;
  }

  const onCancel = () => setModalInfo(null);

  const deleteModal = (
    <CoopModal
      title={
        rules == null || modalInfo == null
          ? 'Delete Rule'
          : `Delete '${rules.find((it) => it.id === modalInfo.id)!.name}'`
      }
      visible={modalInfo?.visible ?? false}
      footer={[
        {
          title: 'Cancel',
          onClick: onCancel,
          type: 'secondary',
        },
        {
          title: 'Delete',
          onClick: () => {
            onDeleteRule(modalInfo!.id);
            setModalInfo(null);
          },
          type: 'primary',
        },
      ]}
      onClose={onCancel}
    >
      Are you sure you want to delete this rule? You can't undo this action.
    </CoopModal>
  );

  const createButton = <CoopButton title="Create Rule" destination="form" />;
  const table = (
    <Table
      columns={columns}
      data={tableData}
      rowLinkTo={rowLinkTo}
      topLeftComponent={
        rulesByStatus.archived?.length ? (
          <TabBar<RuleTableMode>
            tabs={[
              { label: 'Active Rules', value: 'active' },
              { label: 'Archived Rules', value: 'archived' },
            ]}
            initialSelectedTab={'active'}
            onTabClick={setRuleTableMode}
          />
        ) : null
      }
    />
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form"
      buttonTitle="Create Rule"
      dashboardName="Rules"
      icon={<AuditOutlined />}
    />
  );

  const noRulesYet = rules && rules.length === 0;
  const lookback = LookbackLength.ONE_WEEK;

  const timeWindow = (() => {
    //get current time truncated to hour
    const oldestDate = getEarliestDateWithLookback(lookback);
    const oldestHour = moment.utc(oldestDate).startOf('hour').toDate();
    return {
      start: oldestHour,
      end: new Date(),
    };
  })();

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Rules</title>
      </Helmet>
      <DashboardHeader
        title="Rules"
        subtitle="Rules allow you to automate your Trust & Safety enforcement. When you send us content, we run it through all of your Rules, and those Rules can trigger Actions. Below, you can see metrics about how your Rules are performing, and you can browse your entire set of Rules."
        rightComponent={
          noRulesYet ? null : (
            <div className="flex gap-4">
              <Select
                onValueChange={(value) =>
                  setTimeDivision(value as TimeDivisionOptions)
                }
                value={timeDivision}
              >
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.values(TimeDivisionOption).map((val) => (
                      <SelectItem value={val} key={val}>
                        {getDisplayNameForTimeDivision(val)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {createButton}
            </div>
          )
        }
      />
      {noRulesYet ? null : (
        <RuleDashboardInsightsChart
          lookback={lookback}
          timeWindow={timeWindow}
          timeDivision={timeDivision}
          title="Actions"
          initialGroupBy="ACTION_ID"
        />
      )}
      <div className="flex h-px my-4 bg-slate-200" />
      {noRulesYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}
