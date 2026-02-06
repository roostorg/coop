import { PlayCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { MouseEvent, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import CopyTextComponent from '../../../components/common/CopyTextComponent';
import FullScreenLoading from '../../../components/common/FullScreenLoading';
import CoopButton from '../components/CoopButton';
import CoopModal from '../components/CoopModal';
import DashboardHeader from '../components/DashboardHeader';
import EmptyDashboard from '../components/EmptyDashboard';
import RowMutations from '../components/RowMutations';
import { ColumnProps, DefaultColumnFilter } from '../components/table/filters';
import { stringSort, userPenaltySeveritySort } from '../components/table/sort';
import Table from '../components/table/Table';

import {
  GQLUserPermission,
  namedOperations,
  useGQLActionsQuery,
  useGQLDeleteActionMutation,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';
import { titleCaseEnumString } from '../../../utils/string';

type DeleteActionModalInfo = {
  actionId: string;
  visible: boolean;
};

gql`
  query Actions {
    myOrg {
      actions {
        ... on ActionBase {
          id
          name
          description
          penalty
          applyUserStrikes
        }
      }
    }
    me {
      permissions
    }
  }

  mutation DeleteAction($id: ID!) {
    deleteAction(id: $id)
  }
`;

/**
 * Actions Dashboard screen
 */
export default function ActionsDashboard() {
  const { loading, error, data, refetch } = useGQLActionsQuery({
    fetchPolicy: 'network-only',
  });

  const [deleteAction] = useGQLDeleteActionMutation({
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteActionModalInfo | null>(
    null,
  );
  const [canEditActions, setCanEditActions] = useState(true);

  const navigate = useNavigate();

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditActions(
        userHasPermissions(permissions, [GQLUserPermission.ManageOrg]),
      ),
    [permissions],
  );

  const editAction = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    if (actions == null) {
      return;
    }
    navigate(`form/${id}`);
  };

  const onDeleteAction = (id: string) => {
    if (actions == null) {
      return;
    }

    deleteAction({
      variables: {
        id,
      },
      refetchQueries: [namedOperations.Query.Actions],
    });
  };

  const showModal = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    setModalInfo({
      actionId: id,
      visible: true,
    });
  };

  const mutations = (id: string, isMutable: boolean) => {
    return (
      <RowMutations
        canEdit={canEditActions && isMutable}
        editDisabledTooltipTitle={
          !canEditActions
            ? "To edit Actions, ask your organization's admin to upgrade your role to Admin."
            : 'This action is provided by default and cannot be edited.'
        }
        onEdit={(event: MouseEvent) => editAction(id, event)}
        canDelete={canEditActions && isMutable}
        deleteDisabledTooltipTitle={
          !canEditActions
            ? "To delete Actions, ask your organization's admin to upgrade your role to Admin."
            : 'This action is provided by default and cannot be deleted.'
        }
        onDelete={(event: MouseEvent) => showModal(id, event)}
      />
    );
  };

  const columns = useMemo(
    () => [
      {
        Header: 'Name',
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
        Header: 'Description',
        accessor: 'description',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'description',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'Penalty',
        accessor: 'penalty',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'penalty',
          }),
        filter: 'includes',
        sortType: userPenaltySeveritySort,
      },
      {
        Header: 'ID',
        accessor: 'id',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'id',
          }),
        filter: 'text',
        canSort: false,
      },
      {
        Header: '',
        accessor: 'mutations', // accessor is the "key" in the data
        canSort: false,
      },
    ],
    [],
  );
  const actions = data?.myOrg?.actions;

  const tableData = useMemo(
    () => {
      return actions
        ?.slice()
        ?.sort((a, b) => {
          if (a.__typename === 'CustomAction') {
            return -1;
          } else if (b.__typename === 'CustomAction') {
            return 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map((values) => {
          return {
            name: <div className="font-bold">{values.name}</div>,
            description: values.description,
            penalty: titleCaseEnumString(values.penalty),
            id: <CopyTextComponent value={values.id} />,
            mutations: mutations(
              values.id,
              values.__typename === 'CustomAction',
            ),
            values,
          };
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canEditActions, // Included because it's used in mutations()
      mutations,
      actions,
    ],
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
        actions == null || modalInfo == null
          ? 'Delete Action'
          : "Delete '" +
            actions.find((it) => it.id === modalInfo.actionId)!.name +
            "'"
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
            onDeleteAction(modalInfo!.actionId);
            setModalInfo(null);
          },
          type: 'primary',
        },
      ]}
      onClose={onCancel}
    >
      Are you sure you want to delete this action? This cannot be undone.
    </CoopModal>
  );

  const createButton = (
    <CoopButton
      title="Create Action"
      destination="form"
      disabled={!canEditActions}
      disabledTooltipTitle="To create Actions, ask your organization's admin to upgrade your role to Admin."
      disabledTooltipPlacement="bottomRight"
    />
  );

  const table = (
    <div className="rounded-2xl">
      {/* @ts-ignore */}
      <Table columns={columns} data={tableData} />
    </div>
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form"
      buttonTitle="Create Actions"
      dashboardName="Actions"
      icon={<PlayCircleOutlined />}
      buttonDisabled={!canEditActions}
    />
  );

  const noActionsYet = actions && actions.length === 0;

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Actions</title>
      </Helmet>
      <DashboardHeader
        title="Actions"
        subtitle="Coop actions represent real actions you can execute on your content. Once you define those actions here, Coop users can select them from the manual review or you can have your rules automatically execute the actions."
        rightComponent={noActionsYet ? null : createButton}
      />
      {noActionsYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}
