import { GlobalOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
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
} from '../../components/table/filters';
import { stringSort } from '../../components/table/sort';
import Table from '../../components/table/Table';

import {
  GQLUserPermission,
  namedOperations,
  useGQLDeleteLocationBankMutation,
  useGQLLocationBanksQuery,
} from '../../../../graphql/generated';
import { userHasPermissions } from '../../../../routing/permissions';

gql`
  query LocationBanks {
    myOrg {
      banks {
        locationBanks {
          id
          name
          description
        }
      }
    }
    me {
      permissions
    }
  }

  mutation DeleteLocationBank($id: ID!) {
    deleteLocationBank(id: $id)
  }
`;

export default function LocationBanksDashboard() {
  const { loading, error, data, refetch } = useGQLLocationBanksQuery();

  const [deleteLocationBank] = useGQLDeleteLocationBankMutation({
    onError: () => {},
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);
  const [canEditLocationBanks, setCanEditLocationBanks] = useState(true);
  const navigate = useNavigate();

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditLocationBanks(
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
    navigate(`form/location/${id}`);
  };

  const onDeleteBank = (id: string) => {
    deleteLocationBank({
      variables: { id },
      refetchQueries: [namedOperations.Query.LocationBanks],
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
        canDelete={canEditLocationBanks}
        deleteDisabledTooltipTitle="To delete Location Banks, ask your organization's admin to upgrade your role to Rules Manager or Admin."
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
        Header: '',
        accessor: 'mutations', // accessor is the "key" in the data
        canSort: false,
      },
    ],
    [],
  );
  const banks = data?.myOrg?.banks?.locationBanks;

  const dataValues = useMemo(
    () =>
      banks?.map((bank) => ({
        name: bank.name,
        description: bank.description,
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
          values,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canEditLocationBanks, // Included because it's used in mutations()
      mutations,
      dataValues,
    ],
  );

  if (error) {
    return <div />;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  const onCancel = () => setModalInfo(null);

  const deleteModal = (
    <CoopModal
      title={
        banks == null || modalInfo == null
          ? 'Delete Location Bank'
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
      Are you sure you want to delete this location bank? This cannot be undone.
    </CoopModal>
  );

  const table = (
    <div className="rounded-[15px]">
      {/* @ts-ignore */}
      <Table columns={columns} data={tableData} />
    </div>
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form/location"
      buttonTitle="Create Location Banks"
      dashboardName="Location Banks"
      icon={<GlobalOutlined />}
      buttonDisabled={!canEditLocationBanks}
    />
  );

  const noBanksYet = banks && banks.length === 0;

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Location Banks</title>
      </Helmet>
      {noBanksYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}
