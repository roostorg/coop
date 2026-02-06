import { AuditOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import capitalize from 'lodash/capitalize';
import lowerCase from 'lodash/lowerCase';
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
import {
  ColumnProps,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../../components/table/filters';
import {
  reportingRuleStatusSort,
  stringSort,
} from '../../components/table/sort';
import Table from '../../components/table/Table';
import TruncatedListTableCell from '../../components/table/TruncatedListTableCell';
import TruncatedTextTableCell from '../../components/table/TruncatedTextTableCell';
import UserWithAvatar from '../../components/UserWithAvatar';

import {
  GQLReportingRuleStatus,
  GQLRuleStatus,
  GQLUserPermission,
  useGQLDeleteReportingRuleMutation,
  useGQLReportingRulesQuery,
} from '../../../../graphql/generated';
import { userHasPermissions } from '../../../../routing/permissions';

export const REPORTING_RULES_QUERY = gql`
  query ReportingRules {
    myOrg {
      id
      name
      reportingRules {
        id
        name
        creator {
          firstName
          lastName
        }
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
        itemTypes {
          ... on ItemTypeBase {
            id
            name
          }
        }
      }
    }
    me {
      permissions
    }
  }
`;

gql`
  mutation CreateReportingRule($input: CreateReportingRuleInput!) {
    createReportingRule(input: $input) {
      ... on MutateReportingRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation UpdateReportingRule($input: UpdateReportingRuleInput!) {
    updateReportingRule(input: $input) {
      ... on MutateReportingRuleSuccessResponse {
        data {
          id
        }
      }
      ... on Error {
        title
      }
    }
  }

  mutation DeleteReportingRule($id: ID!) {
    deleteReportingRule(id: $id)
  }
`;

export default function ReportingRulesDashboard() {
  const rulesQueryParams = useGQLReportingRulesQuery({
    fetchPolicy: 'network-only',
  });
  // Need to create a copy of the rules array because sort
  // modifies the variable, and the GraphQL response is read-only
  const graphQLRules = rulesQueryParams.data?.myOrg?.reportingRules;
  const rules = useMemo(
    () =>
      graphQLRules != null
        ? [...graphQLRules].sort((a, b) => {
            if (
              a.status === GQLReportingRuleStatus.Archived &&
              b.status !== GQLRuleStatus.Archived
            ) {
              return 1;
            } else if (
              a.status !== GQLRuleStatus.Archived &&
              b.status === GQLRuleStatus.Archived
            ) {
              return -1;
            }
            return a.name.localeCompare(b.name);
          })
        : [],
    [graphQLRules],
  );
  const refetch = rulesQueryParams.refetch;

  const [deleteRule] = useGQLDeleteReportingRuleMutation({
    onError: () => {},
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);

  const navigate = useNavigate();

  const rowLinkTo = (row: Row<any>) => {
    return `info/${row.original.values.id}`;
  };

  const permissions = rulesQueryParams.data?.me?.permissions;
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
      refetchQueries: [{ query: REPORTING_RULES_QUERY }],
    });
  };

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
              rules.find((it) => it.id === id)?.status !==
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
          sortType: reportingRuleStatusSort,
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

  const dataValues = useMemo(
    () =>
      rules.map((rule) => {
        return {
          id: rule.id,
          name: rule.name,
          owner: rule.creator
            ? `${rule.creator.firstName} ${rule.creator.lastName}`
            : 'Removed User',
          status: rule.status,
          policies: rule.policies.map((it) => it.name),
          itemTypes: rule.itemTypes.map((itemType) => itemType.name),
        };
      }),
    [rules],
  );

  const tableData = useMemo(
    () =>
      dataValues
        ?.slice()
        ?.sort((a, b) => a.name.localeCompare(b.name))
        .map((values) => {
          return {
            mutations: mutations(values.id),
            name: (
              <div className="w-80">
                <TruncatedTextTableCell text={values.name} />
              </div>
            ),
            owner: <UserWithAvatar name={values.owner} />,
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
            values,
          };
        }),
    [mutations, dataValues],
  );

  if (rulesQueryParams.error) {
    throw rulesQueryParams.error;
  }
  if (rulesQueryParams.loading) {
    return <FullScreenLoading />;
  }

  const onCancel = () => setModalInfo(null);

  const deleteModal = (
    <CoopModal
      title={
        rules == null || modalInfo == null
          ? 'Delete Report Rule'
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
      Are you sure you want to delete this Report Rule? You can't undo this
      action.
    </CoopModal>
  );

  const createButton = (
    <CoopButton title="Create Report Rule" destination="form" />
  );
  const table = (
    <Table columns={columns} data={tableData} rowLinkTo={rowLinkTo} />
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form"
      buttonTitle="Create Report Rule"
      dashboardName="Report Rules"
      icon={<AuditOutlined />}
    />
  );

  const noRulesYet = rules && rules.length === 0;

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Rules</title>
      </Helmet>
      <DashboardHeader
        title="Report Rules"
        subtitle="Report Rules allow you to automatically process user reports. When content on your platform gets reported or flagged by users, we run that content through all of your Report Rules, which can then trigger Actions. Below, you can see metrics about how your Report Rules are performing, and you can browse your entire set of Report Rules."
        rightComponent={noRulesYet ? null : createButton}
      />
      {/* {noRulesYet ? null : <ReportingRulesDashboardInsights />} */}
      <div className="flex h-px my-4 bg-slate-200" />
      {noRulesYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}
