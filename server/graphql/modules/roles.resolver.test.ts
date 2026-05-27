import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import { resolvers } from './roles.js';

// All four role-editor resolvers gate on MANAGE_ROLES before any persistence
// call. These tests exercise the forbidden path with a minimal mock ctx that
// never reaches the underlying RoleAPI, plus the happy path / validation
// branches that confirm permitted callers reach the data source with
// sanitized input.

type RoleApiMock = {
  listRolesForOrg: jest.Mock;
  getPermissionGroups: jest.Mock;
  updateRolePermissions: jest.Mock;
  renameRole: jest.Mock;
};

function makeCtx(permissions: readonly UserPermission[]) {
  const roleAPI: RoleApiMock = {
    listRolesForOrg: jest.fn(async () => []),
    getPermissionGroups: jest.fn(() => []),
    updateRolePermissions: jest.fn(async () => stubRoleParent()),
    renameRole: jest.fn(async () => stubRoleParent()),
  };
  const ctx = {
    getUser: () => ({
      id: 'user-1',
      orgId: 'org-1',
      getPermissions: () => permissions,
    }),
    dataSources: { roleAPI },
  };
  return { ctx, roleAPI };
}

function stubRoleParent() {
  return {
    id: 'role-1',
    key: UserRole.ADMIN,
    displayName: 'Admin',
    description: 'desc',
    isSystem: true,
    permissions: [UserPermission.MANAGE_ORG],
    isFallback: false,
    userCount: 1,
  };
}

const Query = resolvers.Query as {
  rolesForOrg: (
    parent: unknown,
    args: unknown,
    ctx: unknown,
  ) => Promise<unknown>;
  permissionGroups: (
    parent: unknown,
    args: unknown,
    ctx: unknown,
  ) => Promise<unknown>;
};
const Mutation = resolvers.Mutation as {
  updateRolePermissions: (
    parent: unknown,
    args: { input: { roleKey: string; permissions: readonly string[] } },
    ctx: unknown,
  ) => Promise<unknown>;
  renameRole: (
    parent: unknown,
    args: {
      input: { roleKey: string; displayName: string; description?: string };
    },
    ctx: unknown,
  ) => Promise<unknown>;
};

describe('roles resolvers', () => {
  describe('Query.rolesForOrg', () => {
    it('throws forbiddenError when caller has neither MANAGE_ROLES nor MANAGE_USERS', async () => {
      // MANAGE_ORG alone used to be sufficient here; after the role-editor
      // permission split it is not — the invite + edit flows that need
      // role display data are gated on MANAGE_USERS, and the editor on
      // MANAGE_ROLES. A caller with only MANAGE_ORG should be rejected
      // so we don't accidentally grant role visibility to legacy admins
      // missing both new caps.
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ORG]);
      await expect(Query.rolesForOrg({}, {}, ctx)).rejects.toThrow(
        'User does not have permission to view roles in this organization',
      );
      expect(roleAPI.listRolesForOrg).not.toHaveBeenCalled();
    });

    it('throws unauthenticatedError when caller is anonymous', async () => {
      const ctx = {
        getUser: () => null,
        dataSources: { roleAPI: makeCtx([]).roleAPI },
      };
      await expect(Query.rolesForOrg({}, {}, ctx)).rejects.toThrow(
        'Authenticated user required',
      );
    });

    it('delegates to roleAPI.listRolesForOrg when caller has MANAGE_ROLES', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await Query.rolesForOrg({}, {}, ctx);
      expect(roleAPI.listRolesForOrg).toHaveBeenCalledWith('org-1');
    });

    it('delegates to roleAPI.listRolesForOrg when caller has only MANAGE_USERS', async () => {
      // The invite + edit-user forms render role display names and
      // descriptions, so MANAGE_USERS callers must be able to read the
      // role list even when they cannot edit it. Permissions stay visible
      // here because admins managing users routinely see what permissions
      // their reports have via the User type already.
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_USERS]);
      await Query.rolesForOrg({}, {}, ctx);
      expect(roleAPI.listRolesForOrg).toHaveBeenCalledWith('org-1');
    });
  });

  describe('Query.permissionGroups', () => {
    it('throws forbiddenError when caller lacks MANAGE_ROLES', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.VIEW_MRT]);
      await expect(Query.permissionGroups({}, {}, ctx)).rejects.toThrow(
        'User does not have permission to manage roles',
      );
      expect(roleAPI.getPermissionGroups).not.toHaveBeenCalled();
    });

    it('returns the server-owned groups when caller has MANAGE_ROLES', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await Query.permissionGroups({}, {}, ctx);
      expect(roleAPI.getPermissionGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mutation.updateRolePermissions', () => {
    it('throws forbiddenError when caller lacks MANAGE_ROLES', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ORG]);
      await expect(
        Mutation.updateRolePermissions(
          {},
          { input: { roleKey: 'ADMIN', permissions: [] } },
          ctx,
        ),
      ).rejects.toThrow('User does not have permission to manage roles');
      expect(roleAPI.updateRolePermissions).not.toHaveBeenCalled();
    });

    it('rejects unknown role keys before reaching persistence', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await expect(
        Mutation.updateRolePermissions(
          {},
          { input: { roleKey: 'NOT_A_REAL_ROLE', permissions: [] } },
          ctx,
        ),
      ).rejects.toThrow('Unknown role: NOT_A_REAL_ROLE');
      expect(roleAPI.updateRolePermissions).not.toHaveBeenCalled();
    });

    it('rejects unknown permission strings before reaching persistence', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await expect(
        Mutation.updateRolePermissions(
          {},
          {
            input: {
              roleKey: 'ADMIN',
              permissions: ['MANAGE_ORG', 'INJECTED_FAKE_PERMISSION'],
            },
          },
          ctx,
        ),
      ).rejects.toThrow('Unknown permission: INJECTED_FAKE_PERMISSION');
      expect(roleAPI.updateRolePermissions).not.toHaveBeenCalled();
    });

    it('passes sanitized permissions and the invokers orgId to the data source', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await Mutation.updateRolePermissions(
        {},
        {
          input: {
            roleKey: 'MODERATOR',
            permissions: ['VIEW_MRT', 'VIEW_MRT_DATA'],
          },
        },
        ctx,
      );
      expect(roleAPI.updateRolePermissions).toHaveBeenCalledWith({
        orgId: 'org-1',
        roleKey: 'MODERATOR',
        permissions: [UserPermission.VIEW_MRT, UserPermission.VIEW_MRT_DATA],
      });
    });
  });

  describe('Mutation.renameRole', () => {
    it('throws forbiddenError when caller lacks MANAGE_ROLES', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ORG]);
      await expect(
        Mutation.renameRole(
          {},
          { input: { roleKey: 'ADMIN', displayName: 'New Name' } },
          ctx,
        ),
      ).rejects.toThrow('User does not have permission to manage roles');
      expect(roleAPI.renameRole).not.toHaveBeenCalled();
    });

    it('rejects empty / whitespace-only display names', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await expect(
        Mutation.renameRole(
          {},
          { input: { roleKey: 'ADMIN', displayName: '   ' } },
          ctx,
        ),
      ).rejects.toThrow('displayName must not be empty');
      expect(roleAPI.renameRole).not.toHaveBeenCalled();
    });

    it('rejects display names longer than 255 characters', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await expect(
        Mutation.renameRole(
          {},
          { input: { roleKey: 'ADMIN', displayName: 'A'.repeat(256) } },
          ctx,
        ),
      ).rejects.toThrow('displayName must be at most 255 characters');
      expect(roleAPI.renameRole).not.toHaveBeenCalled();
    });

    it('rejects unknown role keys before reaching persistence', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await expect(
        Mutation.renameRole(
          {},
          { input: { roleKey: 'NOT_A_REAL_ROLE', displayName: 'OK' } },
          ctx,
        ),
      ).rejects.toThrow('Unknown role: NOT_A_REAL_ROLE');
      expect(roleAPI.renameRole).not.toHaveBeenCalled();
    });

    it('trims the display name and forwards the description as null when omitted', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await Mutation.renameRole(
        {},
        { input: { roleKey: 'ADMIN', displayName: '  Admin (renamed)  ' } },
        ctx,
      );
      expect(roleAPI.renameRole).toHaveBeenCalledWith({
        orgId: 'org-1',
        roleKey: 'ADMIN',
        displayName: 'Admin (renamed)',
        description: null,
      });
    });

    it('forwards a provided description verbatim', async () => {
      const { ctx, roleAPI } = makeCtx([UserPermission.MANAGE_ROLES]);
      await Mutation.renameRole(
        {},
        {
          input: {
            roleKey: 'MODERATOR',
            displayName: 'Moderator',
            description: 'Reviews queues',
          },
        },
        ctx,
      );
      expect(roleAPI.renameRole).toHaveBeenCalledWith({
        orgId: 'org-1',
        roleKey: 'MODERATOR',
        displayName: 'Moderator',
        description: 'Reviews queues',
      });
    });
  });
});
