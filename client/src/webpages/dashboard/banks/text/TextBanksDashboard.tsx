import { PlayCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import capitalize from 'lodash/capitalize';
import { MouseEvent, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../../../components/common/FullScreenLoading';
import CoopModal from '../../components/CoopModal';
import EmptyDashboard from '../../components/EmptyDashboard';
import RowMutations, {
  DeleteRowModalInfo,
} from '../../components/RowMutations';
import {
  ColumnProps,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../../components/table/filters';
import { stringSort } from '../../components/table/sort';
import Table from '../../components/table/Table';

import {
  GQLUserPermission,
  namedOperations,
  useGQLDeleteTextBankMutation,
  useGQLTextBanksQuery,
} from '../../../../graphql/generated';
import { userHasPermissions } from '../../../../routing/permissions';

gql`
  query TextBanks {
    myOrg {
      banks {
        textBanks {
          id
          name
          description
          type
        }
      }
    }
    me {
      permissions
    }
  }

  mutation DeleteTextBank($id: ID!) {
    deleteTextBank(id: $id)
  }
`;

export default function TextBanksDashboard() {
  const { loading, error, data, refetch } = useGQLTextBanksQuery({
    fetchPolicy: 'no-cache',
  });

  const [deleteTextBank] = useGQLDeleteTextBankMutation({
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);
  const [canEditTextBanks, setCanEditTextBanks] = useState(true);

  const navigate = useNavigate();

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditTextBanks(
        userHasPermissions(permissions, [GQLUserPermission.MutateLiveRules]),
      ),
    [permissions],
  );

  const editBank = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    if (banks == null) {
      return;
    }
    navigate(`form/text/${id}`);
  };

  const onDeleteBank = (id: string) => {
    deleteTextBank({
      variables: { id },
      refetchQueries: [namedOperations.Query.TextBanks],
    });
  };

  const showModal = (id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    setModalInfo({
      id,
      visible: true,
    });
  };

  const mutations = (id: string) => {
    return (
      <RowMutations
        onEdit={(event: MouseEvent) => editBank(id, event)}
        onDelete={(event: MouseEvent) => showModal(id, event)}
        canDelete={canEditTextBanks}
        deleteDisabledTooltipTitle="To delete Text Banks, ask your organization's admin to upgrade your role to Rules Manager or Admin."
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
        Header: 'Type',
        accessor: 'type',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'type',
          }),
        filter: 'includes',
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
  const banks = data?.myOrg?.banks?.textBanks;

  const dataValues = useMemo(
    () =>
      banks?.map((bank) => ({
        name: bank.name,
        description: bank.description,
        type: capitalize(bank.type),
        id: bank.id,
      })),
    [banks],
  );

  const tableData = useMemo(
    () =>
      dataValues?.map((values) => {
        return {
          mutations: mutations(values.id),
          name: values.name,
          description: <div className="italic">{values.description}</div>,
          type: <div className="whitespace-nowrap">{values.type}</div>,
          values,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canEditTextBanks, // Included because it's used in mutations()
      mutations,
      dataValues,
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
        banks == null || modalInfo == null
          ? 'Delete Text Bank'
          : `Delete '${banks.find((it) => it.id === modalInfo.id)!.name}'`
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
            onDeleteBank(modalInfo!.id);
            setModalInfo(null);
          },
          type: 'primary',
        },
      ]}
      onClose={onCancel}
    >
      Are you sure you want to delete this text bank? This cannot be undone.
    </CoopModal>
  );

  const table = (
    <div className="rounded-2xl">
      {/* @ts-ignore */}
      <Table columns={columns} data={tableData} />
    </div>
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form/text"
      buttonTitle="Create Text Banks"
      dashboardName="Text Banks"
      icon={<PlayCircleOutlined />}
      buttonDisabled={!canEditTextBanks}
    />
  );

  const noBanksYet = banks && banks.length === 0;

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Text Banks</title>
      </Helmet>
      {noBanksYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}
