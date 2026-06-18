import { Checkbox } from '@/coop-ui/Checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/coop-ui/Dialog';
import { Input } from '@/coop-ui/Input';
import { Textarea } from '@/coop-ui/Textarea';
import {
  GQLUserPermission,
  GQLUserRole,
  useGQLPermissionGroupsQuery,
  useGQLRenameRoleMutation,
  useGQLUpdateRolePermissionsMutation,
} from '@/graphql/generated';
import { gql } from '@apollo/client';
import { Info, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import CoopButton from '../dashboard/components/CoopButton';

gql`
  query PermissionGroups {
    permissionGroups {
      key
      label
      description
      permissions {
        permission
        label
        description
      }
    }
  }

  mutation UpdateRolePermissions($input: UpdateRolePermissionsInput!) {
    updateRolePermissions(input: $input) {
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

  mutation RenameRole($input: RenameRoleInput!) {
    renameRole(input: $input) {
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

type EditableRole = {
  key: GQLUserRole;
  displayName: string;
  description?: string | null;
  permissions: readonly GQLUserPermission[];
  isFallback: boolean;
  userCount: number;
};

const MAX_DISPLAY_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Combined editor for a single role: displayName + description + grouped
 * permissions. Saves rename and permissions independently and only when
 * dirty, so a permissions failure doesn't roll back a successful rename.
 */
export default function RoleEditDialog(props: {
  role: EditableRole;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  refetchQueries: readonly string[];
}) {
  const { role, onClose, onSaved, refetchQueries } = props;

  const { data: groupsData, loading: groupsLoading } =
    useGQLPermissionGroupsQuery();

  const [displayName, setDisplayName] = useState(role.displayName);
  const [description, setDescription] = useState(role.description ?? '');
  const [permissions, setPermissions] = useState<Set<GQLUserPermission>>(
    () => new Set(role.permissions),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Re-sync state if the parent swaps `role` without remounting the dialog.
  useEffect(() => {
    setDisplayName(role.displayName);
    setDescription(role.description ?? '');
    setPermissions(new Set(role.permissions));
    setSubmitError(null);
  }, [role.key, role.displayName, role.description, role.permissions]);

  const [updatePermissions, { loading: savingPermissions }] =
    useGQLUpdateRolePermissionsMutation({
      refetchQueries: [...refetchQueries],
    });
  const [renameRole, { loading: renaming }] = useGQLRenameRoleMutation({
    refetchQueries: [...refetchQueries],
  });

  const trimmedName = displayName.trim();
  const trimmedDescription = description.trim();
  const originalDescription = (role.description ?? '').trim();

  const nameDirty = trimmedName !== role.displayName.trim();
  const descriptionDirty = trimmedDescription !== originalDescription;
  const permissionsDirty = useMemo(() => {
    if (permissions.size !== role.permissions.length) return true;
    for (const p of role.permissions) {
      if (!permissions.has(p)) return true;
    }
    return false;
  }, [permissions, role.permissions]);

  const isDirty = nameDirty || descriptionDirty || permissionsDirty;
  const isSaving = savingPermissions || renaming;

  const nameError = (() => {
    if (trimmedName.length === 0) return 'Name is required.';
    if (trimmedName.length > MAX_DISPLAY_NAME_LENGTH)
      return `Name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`;
    return null;
  })();
  const descriptionError = (() => {
    if (trimmedDescription.length === 0) return 'Description is required.';
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH)
      return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
    return null;
  })();

  const togglePermission = (p: GQLUserPermission) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (nameError != null || descriptionError != null) return;
    setSubmitError(null);

    try {
      // Rename first so a permissions failure doesn't strand the rename.
      if (nameDirty || descriptionDirty) {
        await renameRole({
          variables: {
            input: {
              roleKey: role.key,
              displayName: trimmedName,
              description:
                trimmedDescription.length > 0 ? trimmedDescription : null,
            },
          },
        });
      }

      if (permissionsDirty) {
        await updatePermissions({
          variables: {
            input: {
              roleKey: role.key,
              permissions: Array.from(permissions),
            },
          },
        });
      }

      await onSaved();
    } catch (e: unknown) {
      setSubmitError(
        e instanceof Error ? e.message : 'Failed to save role changes.',
      );
    }
  };

  const groups = groupsData?.permissionGroups ?? [];
  const saveDisabled =
    !isDirty || isSaving || nameError != null || descriptionError != null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!max-w-[880px] w-[92vw] p-0">
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="flex flex-col">
            <DialogTitle className="text-2xl">Edit Role</DialogTitle>
            <div className="text-sm text-gray-600 mt-1">
              Update the role name, description, and permissions.
            </div>
          </div>
          <DialogClose
            aria-label="Close"
            className="text-gray-500 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" aria-hidden />
          </DialogClose>
        </div>
        <div className="flex flex-col gap-5 px-6 pb-2 max-h-[60vh] overflow-y-auto">
          <div
            className="flex items-start gap-3 text-sm bg-blue-50 border border-blue-200 rounded p-3"
            role="status"
          >
            <Info
              className="w-4 h-4 mt-0.5 text-blue-600 shrink-0"
              aria-hidden
            />
            <div className="text-blue-900">
              {role.userCount > 0
                ? `Any changes to this role will retroactively affect all ${role.userCount} user${role.userCount === 1 ? '' : 's'} currently assigned to this role.`
                : 'Any changes to this role will retroactively apply to every user assigned to this role.'}
            </div>
          </div>

          {role.isFallback && (
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
              This role is currently using default permissions for your
              organization. Saving will create a custom configuration that
              overrides the defaults.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-semibold"
              htmlFor="role-display-name"
            >
              Role Name <span className="text-red-600">*</span>
            </label>
            <Input
              id="role-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              disabled={isSaving}
              className={
                nameError != null
                  ? '!border-red-500 focus:!border-red-500'
                  : undefined
              }
            />
            {nameError != null && (
              <div className="text-xs text-red-600">{nameError}</div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold" htmlFor="role-description">
              Description <span className="text-red-600">*</span>
            </label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              disabled={isSaving}
              className={
                descriptionError != null
                  ? '!border-red-500 focus:!border-red-500'
                  : undefined
              }
            />
            {descriptionError != null && (
              <div className="text-xs text-red-600">{descriptionError}</div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              Permissions <span className="text-red-600">*</span>{' '}
              <span className="text-gray-500 font-normal">
                ({permissions.size} selected)
              </span>
            </label>
            {groupsLoading && (
              <div className="text-sm text-gray-500">Loading permissions…</div>
            )}
            {!groupsLoading && (
              <div className="border border-gray-200 rounded-md p-4 max-h-[320px] overflow-y-auto flex flex-col gap-5">
                {groups.map((group) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <div className="text-sm font-semibold">{group.label}</div>
                    {group.description && (
                      <div className="text-xs text-gray-600">
                        {group.description}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 pl-1">
                      {group.permissions.map((p) => {
                        const checked = permissions.has(p.permission);
                        return (
                          <label
                            key={p.permission}
                            className="flex items-start gap-3 py-1 cursor-pointer"
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={checked}
                              onCheckedChange={() =>
                                togglePermission(p.permission)
                              }
                              disabled={isSaving}
                            />
                            <div className="flex flex-col">
                              <div className="text-sm font-medium">
                                {p.label}
                              </div>
                              {p.description && (
                                <div className="text-xs text-gray-600">
                                  {p.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError != null && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {submitError}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <CoopButton
            title="Cancel"
            type="secondary"
            onClick={onClose}
            disabled={isSaving}
          />
          <CoopButton
            title={isSaving ? 'Saving…' : 'Save Changes'}
            onClick={handleSave}
            loading={isSaving}
            disabled={saveDisabled}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
