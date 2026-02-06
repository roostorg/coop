import React, { useMemo, useState, useCallback } from 'react';
import { Tag } from 'antd';
import { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  useGQLHashBanksQuery,
  useGQLDeleteHashBankMutation,
  namedOperations
} from '../../../../graphql/generated';
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
import CustomTable from '../../components/table/Table';
import FullScreenLoading from '../../../../components/common/FullScreenLoading';

const getStatusColor = (enabled_ratio: number) => {
  if (enabled_ratio === 0) return 'red';
  if (enabled_ratio < 1) return 'orange';
  return 'green';
};

const getStatusText = (enabled_ratio: number) => {
  if (enabled_ratio === 0) return 'Disabled';
  if (enabled_ratio < 1) return `${Math.round(enabled_ratio * 100)}% Enabled`;
  return 'Enabled';
};

export default function HashBanksDashboard() {
  const { loading, error, data, refetch } = useGQLHashBanksQuery({
    fetchPolicy: 'no-cache',
  });

  const [deleteHashBank] = useGQLDeleteHashBankMutation({
    onCompleted: async () => refetch(),
  });
  const [modalInfo, setModalInfo] = useState<DeleteRowModalInfo | null>(null);

  const navigate = useNavigate();

  const editBank = useCallback((id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    navigate(`/dashboard/rules/banks/form/hash/${id}`);
  }, [navigate]);

  const onDeleteBank = useCallback((id: string) => {
    deleteHashBank({
      variables: { id },
      refetchQueries: [namedOperations.Query.HashBanks],
    });
  }, [deleteHashBank]);

  const showModal = useCallback((id: string, event: MouseEvent) => {
    // This ensures that the row's onClick isn't called because
    // the row is the parent component
    event.stopPropagation();
    setModalInfo({
      id,
      visible: true,
    });
  }, []);

  const mutations = useCallback((id: string) => {
    return (
      <RowMutations
        onEdit={(event: MouseEvent) => editBank(id, event)}
        onDelete={(event: MouseEvent) => showModal(id, event)}
        canDelete={true}
      />
    );
  }, [editBank, showModal]);

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
        Header: 'Status',
        accessor: 'enabled_ratio',
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
  const banks = data?.hashBanks;

  const dataValues = useMemo(
    () =>
      banks?.map((bank) => ({
        name: bank.name,
        description: bank.description,
        enabled_ratio: bank.enabled_ratio,
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
          enabled_ratio: (
            <Tag color={getStatusColor(values.enabled_ratio)}>
              {getStatusText(values.enabled_ratio)}
            </Tag>
          ),
          values,
        };
      }),
    [mutations, dataValues],
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
          ? 'Delete Hash Bank'
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
      Are you sure you want to delete this hash bank? This cannot be undone.
    </CoopModal>
  );

  const table = (
    <div className="rounded-2xl">
      {/* @ts-ignore */}
      <CustomTable columns={columns} data={tableData} />
    </div>
  );

  const emptyDashboard = (
    <EmptyDashboard
      buttonLinkPath="form/hash"
      buttonTitle="Create Hash Banks"
      dashboardName="Hash Banks"
      icon={<div>🔍</div>}
    />
  );

  const noBanksYet = banks && banks.length === 0;

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Hash Banks</title>
      </Helmet>
      {noBanksYet ? emptyDashboard : table}
      {deleteModal}
    </div>
  );
}