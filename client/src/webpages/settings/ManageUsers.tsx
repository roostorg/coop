import { gql } from '@apollo/client';
import { Select } from 'antd';
import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';
import CoopButton from '../dashboard/components/CoopButton';
import CoopModal from '../dashboard/components/CoopModal';
import DashboardHeader from '../dashboard/components/DashboardHeader';
import RowMutations from '../dashboard/components/RowMutations';
import {
  ColumnProps,
  DateRangeColumnFilter,
  DefaultColumnFilter,
  SelectColumnFilter,
} from '../dashboard/components/table/filters';
import {
  boolSort,
  stringSort,
  userRoleSort,
} from '../dashboard/components/table/sort';
import Table from '../dashboard/components/table/Table';
import UserWithAvatar from '../dashboard/components/UserWithAvatar';

import {
  GQLUserPermission,
  GQLUserRole,
  namedOperations,
  useGQLApproveUserMutation,
  useGQLDeleteInviteMutation,
  useGQLDeleteUserMutation,
  useGQLGeneratePasswordResetTokenMutation,
  useGQLManageUsersQuery,
  useGQLRejectUserMutation,
  useGQLUpdateRoleMutation,
} from '../../graphql/generated';
import { userHasPermissions } from '../../routing/permissions';
import { titleCaseEnumString } from '../../utils/string';
import { getRoleDescription } from './ManageUsersFormUtils';
import ManageUsersInviteUserSection from './ManageUsersInviteUserSection';

const { Option } = Select;

export enum ManageUsersModalState {
  DELETE_CONFIRMATION = 'DELETE_CONFIRMATION',
  EDIT_USER = 'EDIT_USER',
  ACTION_FAILED = 'ACTION_FAILED',
}

gql`
  query ManageUsers {
    myOrg {
      id
      name
      hasNCMECReportingEnabled
      users {
        id
        firstName
        lastName
        email
        role
        createdAt
        approvedByAdmin
        rejectedByAdmin
      }
      pendingInvites {
        id
        email
        role
        createdAt
      }
    }
    me {
      id
      email
      firstName
      lastName
      permissions
    }
  }

  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }

  mutation UpdateRole($input: UpdateRoleInput!) {
    updateRole(input: $input)
  }

  mutation ApproveUser($id: ID!) {
    approveUser(id: $id)
  }

  mutation RejectUser($id: ID!) {
    rejectUser(id: $id)
  }

  mutation DeleteInvite($id: ID!) {
    deleteInvite(id: $id)
  }

  mutation GeneratePasswordResetToken($userId: ID!) {
    generatePasswordResetToken(userId: $userId)
  }
`;

export default function ManageUsers() {
  // Lowest level permission required to manage users
  const requiredPermissions = [GQLUserPermission.ManageOrg];

  const [modalState, setModalState] = useState<
    ManageUsersModalState | undefined
  >(undefined);
  const [selectedUser, setSelectedUser] = useState<
    { id: string; name: string; role: GQLUserRole } | undefined
  >(undefined);
  const [selectedRole, setSelectedRole] = useState<GQLUserRole | undefined>(
    undefined,
  );
  const [passwordResetToken, setPasswordResetToken] = useState<
    string | undefined
  >(undefined);
  const [copySuccess, setCopySuccess] = useState(false);
  const navigate = useNavigate();

  const { data, loading, error, refetch } = useGQLManageUsersQuery();
  const users = data?.myOrg?.users;
  const pendingInvites = data?.myOrg?.pendingInvites;
  const hasNCMECReportingEnabled = data?.myOrg?.hasNCMECReportingEnabled;

  const hideModal = () => {
    setModalState(undefined);
    setPasswordResetToken(undefined);
    setCopySuccess(false);
  };

  const mutationCallbacks = {
    onError: () =>
      showModal({ newModalState: ManageUsersModalState.ACTION_FAILED }),
    onCompleted: () => {
      hideModal();
      refetch();
    },
  };

  const [deleteUser, { loading: deleteUserLoading }] =
    useGQLDeleteUserMutation(mutationCallbacks);
  const [updateRole, { loading: updateRoleLoading }] =
    useGQLUpdateRoleMutation(mutationCallbacks);
  const [approveUser, { loading: approveUserLoading }] =
    useGQLApproveUserMutation(mutationCallbacks);
  const [rejectUser, { loading: rejectUserLoading }] =
    useGQLRejectUserMutation(mutationCallbacks);
  const [deleteInvite] = useGQLDeleteInviteMutation(mutationCallbacks);
  const [generatePasswordResetToken, { loading: generateTokenLoading }] =
    useGQLGeneratePasswordResetTokenMutation({
      onCompleted: (data) => {
        if (data.generatePasswordResetToken) {
          setPasswordResetToken(data.generatePasswordResetToken);
        }
      },
      onError: () =>
        showModal({ newModalState: ManageUsersModalState.ACTION_FAILED }),
    });

  const showModal = useCallback(
    (opts: {
      newModalState: ManageUsersModalState;
      userId?: string;
      event?: MouseEvent;
    }) => {
      const { newModalState, userId, event } = opts;
      // This ensures that the row's onClick isn't called because
      // the row is the parent component
      event?.stopPropagation();
      const user = users?.find((it) => it.id === userId);
      if (user) {
        setSelectedUser({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role!,
        });
      }
      setModalState(newModalState);
    },
    [users],
  );

  const onDeleteUser = () => {
    deleteUser({
      variables: {
        id: selectedUser!.id,
      },
      refetchQueries: [namedOperations.Query.ManageUsers],
    });
  };

  const onEditUser = (role: GQLUserRole) => {
    updateRole({
      variables: {
        input: {
          id: selectedUser!.id,
          role,
        },
      },
      refetchQueries: [namedOperations.Query.ManageUsers],
    });
  };

  const onGeneratePasswordReset = useCallback(() => {
    if (selectedUser?.id) {
      generatePasswordResetToken({
        variables: { userId: selectedUser.id },
      });
    }
  }, [selectedUser?.id, generatePasswordResetToken]);

  const copyPasswordResetLink = () => {
    if (passwordResetToken) {
      const uiUrl = process.env.REACT_APP_UI_URL ?? window.location.origin;
      const resetUrl = `${uiUrl}/reset_password/${passwordResetToken}`;
      navigator.clipboard.writeText(resetUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const mutations = useCallback(
    (id: string) => {
      return (
        <RowMutations
          onEdit={(event) =>
            showModal({
              newModalState: ManageUsersModalState.EDIT_USER,
              userId: id,
              event,
            })
          }
          onDelete={(event) =>
            showModal({
              newModalState: ManageUsersModalState.DELETE_CONFIRMATION,
              userId: id,
              event,
            })
          }
          // Assertion safe, see onDeleteUser above
          canDelete={id !== data?.me?.id}
          deleteDisabledTooltipTitle={
            'You cannot delete your own account. ' +
            'If you are leaving your company and need to ' +
            'delete the account, ensure that another user in your ' +
            'organization is assigned the Admin role, and request ' +
            'that they delete your account.'
          }
        />
      );
    },
    [data?.me?.id, showModal],
  );

  const inviteMutations = useCallback(
    (id: string) => {
      return (
        <RowMutations
          onEdit={() => {}}
          canEdit={false}
          onDelete={async (event) => {
            event?.stopPropagation();
            await deleteInvite({
              variables: { id },
              refetchQueries: [namedOperations.Query.ManageUsers],
            });
          }}
        />
      );
    },
    [deleteInvite],
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
            placeholder: 'Jane Smith',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'Email',
        accessor: 'email',
        Filter: (props: ColumnProps) =>
          DefaultColumnFilter({
            columnProps: props,
            accessor: 'email',
            placeholder: 'jane@mywebsite.com',
          }),
        filter: 'text',
        sortType: stringSort,
      },
      {
        Header: 'Role',
        accessor: 'role',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'role',
            placeholder: 'Filter by role',
          }),
        filter: 'includes',
        sortType: userRoleSort,
      },
      {
        Header: 'Approval Status',
        accessor: 'approvalStatus',
        Filter: (props: ColumnProps) =>
          SelectColumnFilter({
            columnProps: props,
            accessor: 'approvalStatus',
            placeholder: 'Filter by status',
          }),
        filter: 'includes',
        sortType: boolSort,
      },
      {
        Header: 'Date Created',
        accessor: 'dateCreated',
        Filter: (props: ColumnProps) =>
          DateRangeColumnFilter({
            columnProps: props,
            accessor: 'dateCreated',
            placeholder: '',
          }),
        filter: 'dateRange',
        sortDescFirst: true,
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

  const dataValues = useMemo(() => {
    const userData =
      users
        ?.filter((user) => !user.rejectedByAdmin)
        .map((user) => ({
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: titleCaseEnumString(user.role ?? ''),
          approvalStatus: Boolean(user.approvedByAdmin)
            ? 'Approved'
            : 'Pending',
          id: user.id,
          dateCreated: new Date(Number(user.createdAt))
            .toISOString()
            .split('T')[0],
          isPendingInvite: false,
        })) ?? [];

    const inviteData =
      pendingInvites?.map((invite) => ({
        name: 'Pending Invite',
        email: invite.email,
        role: titleCaseEnumString(invite.role ?? ''),
        approvalStatus: 'Invited',
        id: invite.id,
        dateCreated: new Date(invite.createdAt).toISOString().split('T')[0],
        isPendingInvite: true,
      })) ?? [];

    return [...userData, ...inviteData];
  }, [users, pendingInvites]);

  const tableData = useMemo(
    () =>
      dataValues?.map((values: any) => ({
        mutations: values.isPendingInvite
          ? inviteMutations(values.id)
          : mutations(values.id),
        name: <UserWithAvatar name={values.name} />,
        email: <div>{values.email}</div>,
        role: <div>{values.role}</div>,
        approvalStatus:
          values.approvalStatus === 'Invited' ? (
            <div className="text-orange-600 font-medium">Pending Invite</div>
          ) : values.approvalStatus === 'Approved' ? (
            <div>Approved</div>
          ) : (
            <div className="flex gap-2">
              <CoopButton
                title="Approve"
                type="green"
                size="small"
                onClick={async () =>
                  approveUser({
                    variables: { id: values.id },
                  })
                }
                loading={approveUserLoading}
              />
              <CoopButton
                title="Reject"
                type="danger"
                size="small"
                onClick={async () =>
                  rejectUser({
                    variables: { id: values.id },
                  })
                }
                loading={rejectUserLoading}
              />
            </div>
          ),
        dateCreated: <div className="flex min-w-20">{values.dateCreated}</div>,
        values,
      })),
    [
      dataValues,
      mutations,
      inviteMutations,
      approveUserLoading,
      rejectUserLoading,
      approveUser,
      rejectUser,
    ],
  );

  if (loading) {
    return <FullScreenLoading />;
  }

  if (error) {
    throw error;
  }
  const permissions = data!.me?.permissions;
  if (!permissions || !userHasPermissions(permissions, requiredPermissions)) {
    navigate('/settings');
  }

  const {
    title = '',
    body = null,
    buttons = [],
  } = (() => {
    switch (modalState) {
      case ManageUsersModalState.ACTION_FAILED:
        return {
          title: 'Something went wrong',
          body: (
            <div>
              We encountered an issue trying to process your request. Please try
              again.
            </div>
          ),
          buttons: [],
        };
      case ManageUsersModalState.DELETE_CONFIRMATION:
        return {
          title: 'Delete User',
          body: <div>Are you sure you want to delete this user?</div>,
          buttons: [
            {
              title: 'Cancel',
              onClick: hideModal,
              type: 'secondary' as const,
            },
            {
              title: 'Delete',
              onClick: onDeleteUser,
              type: 'danger' as const,
              loading: deleteUserLoading,
            },
          ],
        };
      case ManageUsersModalState.EDIT_USER:
        return {
          title: 'Edit User',
          body: (
            <div className="max-w-[600px]">
              {/* Edit Role Section */}
              <div className="flex flex-col items-start">
                <div className="text-xl font-bold mb-4">Edit Role</div>
                <div className="mb-2 font-semibold">Select Role</div>
                <Select
                  className="!w-full"
                  value={selectedRole ?? selectedUser?.role}
                  onSelect={(value) => setSelectedRole(value)}
                  dropdownMatchSelectWidth={false}
                >
                  {Object.values(GQLUserRole)
                    // If the org doesn't have NCMEC reporting enabled, don't show the CHILD_SAFETY_MODERATOR role
                    .filter((role) =>
                      !hasNCMECReportingEnabled
                        ? role !== GQLUserRole.ChildSafetyModerator
                        : true,
                    )
                    .map((roleType) => (
                      <Option
                        key={roleType}
                        value={roleType}
                        label={titleCaseEnumString(roleType)}
                      >
                        {titleCaseEnumString(roleType)}
                      </Option>
                    ))}
                </Select>
              </div>
              
              <div className="divider !mb-6 !mt-8" />
              
              {/* Reset Password Section */}
              <div className="flex flex-col items-start">
                <div className="text-xl font-bold mb-4">Reset Password</div>
                <div className="mb-3 text-sm text-gray-600">
                  Generate a password reset link for this user. An email will be sent if email service is configured.
                </div>
                <CoopButton
                  title="Generate Reset Link"
                  size="middle"
                  type="secondary"
                  onClick={onGeneratePasswordReset}
                  loading={generateTokenLoading}
                />
                
                {passwordResetToken && (
                  <div className="mt-4 flex flex-col gap-2 w-full">
                    <div className="text-sm font-semibold">Password Reset Link:</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${
                          process.env.REACT_APP_UI_URL ?? window.location.origin
                        }/reset_password/${passwordResetToken}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-gray-50"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <CoopButton
                        title={copySuccess ? '✓ Copied!' : 'Copy'}
                        size="middle"
                        onClick={copyPasswordResetLink}
                        type={copySuccess ? 'primary' : 'secondary'}
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      This link will expire in 1 hour.
                    </div>
                  </div>
                )}
              </div>
              
              <div className="divider !mb-6 !mt-8" />
              
              {/* Roles Description Section */}
              <div className="text-xl font-bold mb-4">Role Descriptions</div>
              <div className="flex flex-col text-start">
                {Object.values(GQLUserRole)
                  // If the org doesn't have NCMEC reporting enabled, don't show the CHILD_SAFETY_MODERATOR role
                  .filter((role) =>
                    !hasNCMECReportingEnabled
                      ? role !== GQLUserRole.ChildSafetyModerator
                      : true,
                  )
                  .map((role) => (
                    <div key={role} className="flex flex-col">
                      <div className="text-base font-bold">
                        {titleCaseEnumString(role)}
                      </div>
                      <div className="pt-1 pb-4">
                        {getRoleDescription(role)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ),
          buttons: [
            {
              title: 'Cancel',
              onClick: () => {
                hideModal();
                setPasswordResetToken(undefined);
                setCopySuccess(false);
              },
              type: 'secondary' as const,
            },
            {
              title: 'Save Role',
              onClick: () => onEditUser(selectedRole!),
              loading: updateRoleLoading,
              disabled: !selectedRole || selectedUser?.role === selectedRole,
            },
          ],
        };
      default:
        return {};
    }
  })();

  const modal = (
    <CoopModal
      visible={modalState !== undefined}
      onClose={hideModal}
      title={title}
      footer={buttons}
    >
      {body}
    </CoopModal>
  );

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>Users</title>
      </Helmet>
      <DashboardHeader title="Users" subtitle="" />
      {/* @ts-ignore */}
      <Table columns={columns} data={tableData} />
      <div className="divider my-9" />
      <ManageUsersInviteUserSection />
      {modal}
    </div>
  );
}
