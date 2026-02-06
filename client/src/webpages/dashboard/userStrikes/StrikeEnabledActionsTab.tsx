import { Switch } from '@/coop-ui/Switch';
import { useMemo, useState } from 'react';

import FullScreenLoading from '../../../components/common/FullScreenLoading';
import { ColumnProps, DefaultColumnFilter } from '../components/table/filters';
import Table from '../components/table/Table';

import {
  GQLUserPermission,
  useGQLActionsQuery,
  useGQLUpdateActionMutation,
} from '../../../graphql/generated';
import { userHasPermissions } from '../../../routing/permissions';

export default function StrikeEnabledActionsTab() {
  const {
    loading,
    error,
    data,
    refetch: refetchAllActions,
  } = useGQLActionsQuery({
    fetchPolicy: 'network-only',
  });
  const [updateAction] = useGQLUpdateActionMutation({
    onCompleted: () => {
      refetchAllActions();
    },
  });

  const [canEditActions, setCanEditActions] = useState(true);

  const permissions = data?.me?.permissions;
  useMemo(
    () =>
      setCanEditActions(
        userHasPermissions(permissions, [GQLUserPermission.ManageOrg]),
      ),
    [permissions],
  );

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
        canSort: false,
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
        canSort: false,
      },
      {
        Header: 'Enable Strikes',
        accessor: 'enableStrikes', // accessor is the "key" in the data
        canSort: false,
      },
      {
        Header: '',
        accessor: 'CustomAction', // accessor is the "key" in the data
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
          return a.name.localeCompare(b.name);
        })
        .map((values) => {
          return {
            name: <div className="font-bold">{values.name}</div>,
            description: values.description,
            enableStrikes: (
              <Switch
                disabled={values.__typename !== 'CustomAction'}
                checked={values.applyUserStrikes!}
                onCheckedChange={async (isChecked) => {
                  await updateAction({
                    variables: {
                      input: {
                        id: values.id,
                        applyUserStrikes: isChecked,
                      },
                    },
                  });
                }}
              />
            ),
            customAction:
              values.__typename === 'CustomAction'
                ? ''
                : 'Auto-generated action',
            values,
          };
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      canEditActions, // Included because it's used in mutations()
      actions,
    ],
  );

  if (error) {
    throw error;
  }
  if (loading) {
    return <FullScreenLoading />;
  }

  const table = (
    <div className="rounded-2xl">
      {/* @ts-ignore */}
      <Table columns={columns} data={tableData} />
    </div>
  );

  return <div className="flex flex-col">{table}</div>;
}
