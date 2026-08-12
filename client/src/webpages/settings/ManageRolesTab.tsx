import { Popover, PopoverContent, PopoverTrigger } from '@/coop-ui/Popover';
import {
  GQLUserRole,
  namedOperations,
  useGQLRolesForOrgQuery,
} from '@/graphql/generated';
import { titleCaseEnumString } from '@/utils/string';
import { gql } from '@apollo/client';
import { Eye, MoreHorizontal, Pencil, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';

import CoopButton from '../dashboard/components/CoopButton';

import PermissionsMatrixModal from './PermissionsMatrixModal';
import RoleEditDialog from './RoleEditDialog';

gql`
  query RolesForOrg {
    rolesForOrg {
      id
      key
      displayName
      description
      isSystem
      isFallback
      permissions
      userCount
    }
  }
`;

/**
 * Roles tab inside Manage Users. Lists every role with its permission count
 * and an Edit affordance, gated on MANAGE_ROLES at the parent page.
 */
export default function ManageRolesTab() {
  const { data, loading, error, refetch } = useGQLRolesForOrgQuery();
  const [editingRoleKey, setEditingRoleKey] = useState<GQLUserRole | null>(
    null,
  );
  const [openMenuKey, setOpenMenuKey] = useState<GQLUserRole | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  if (error) {
    throw error;
  }

  const roles = data?.rolesForOrg ?? [];
  const editingRole =
    editingRoleKey != null
      ? (roles.find((r) => r.key === editingRoleKey) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <div className="text-xl font-bold">Roles Management</div>
          <div className="text-sm text-gray-600 mt-1">
            Configure roles and the permissions they grant. Editing a role
            updates every user assigned to that role.
          </div>
        </div>
        <div>
          <CoopButton
            title="View Permissions"
            icon={Eye}
            iconStyle="stroke"
            type="secondary"
            onClick={() => setMatrixOpen(true)}
            disabled={loading || roles.length === 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => {
          const roleLabel = role.displayName || titleCaseEnumString(role.key);
          return (
            <div
              key={role.key}
              className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 min-h-[160px]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold flex-1">
                  {roleLabel}
                </div>
                <Popover
                  open={openMenuKey === role.key}
                  onOpenChange={(open) =>
                    setOpenMenuKey(open ? role.key : null)
                  }
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
                      aria-label={`Open ${roleLabel} role menu`}
                    >
                      <MoreHorizontal className="w-4 h-4" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={4}
                    className="w-40 p-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuKey(null);
                        setEditingRoleKey(role.key);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden />
                      Edit Role
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
              {role.description && (
                <div className="text-sm text-gray-600 line-clamp-4">
                  {role.description}
                </div>
              )}
              {role.isFallback && (
                <div className="text-xs text-gray-500 italic">
                  Using default permissions. Save changes to customize for your
                  organization.
                </div>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" aria-hidden />
                  {role.userCount} user{role.userCount === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                  {role.permissions.length} permission
                  {role.permissions.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {editingRole && (
        <RoleEditDialog
          role={editingRole}
          onClose={() => setEditingRoleKey(null)}
          onSaved={async () => {
            await refetch();
            setEditingRoleKey(null);
          }}
          refetchQueries={[namedOperations.Query.RolesForOrg]}
        />
      )}

      {matrixOpen && (
        <PermissionsMatrixModal
          roles={roles}
          onClose={() => setMatrixOpen(false)}
        />
      )}
    </div>
  );
}
