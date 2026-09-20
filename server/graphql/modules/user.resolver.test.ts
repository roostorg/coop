import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './user.js';

describe('user resolvers', () => {
  describe('Mutation.deleteUser', () => {
    function makeCtx(permissions: readonly UserPermission[]) {
      const deleteUser = jest.fn(async () => true);
      const ctx = {
        getUser: () => ({
          id: 'admin-1',
          orgId: 'org-1',
          getPermissions: () => permissions,
        }),
        dataSources: { userAPI: { deleteUser } },
      };
      return { ctx, deleteUser };
    }

    const Mutation = resolvers.Mutation as {
      deleteUser: (
        parent: unknown,
        args: { id: string },
        ctx: unknown,
      ) => Promise<unknown>;
    };

    it('throws forbiddenError when caller lacks MANAGE_USERS', async () => {
      const { ctx, deleteUser } = makeCtx([
        UserPermission.VIEW_MRT,
        UserPermission.VIEW_MRT_DATA,
        // Carrying MANAGE_ORG without MANAGE_USERS used to be enough; after
        // the permission split for the role-editor (issue #406) user-mutation
        // resolvers gate strictly on MANAGE_USERS, so this caller must be
        // rejected even though they hold the legacy "highest-impact" cap.
        UserPermission.MANAGE_ORG,
      ]);
      await expect(
        Mutation.deleteUser({}, { id: 'victim-1' }, ctx),
      ).rejects.toThrow('User does not have permission to delete users');
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('delegates to userAPI.deleteUser when caller has MANAGE_USERS', async () => {
      const { ctx, deleteUser } = makeCtx([UserPermission.MANAGE_USERS]);
      await expect(
        Mutation.deleteUser({}, { id: 'victim-1' }, ctx),
      ).resolves.toBe(true);
      expect(deleteUser).toHaveBeenCalledWith({
        id: 'victim-1',
        orgId: 'org-1',
      });
    });
  });
});
