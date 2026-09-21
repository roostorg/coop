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

  describe('MRT favorites respect the caller queue access', () => {
    const caller = {
      id: 'caller-1',
      orgId: 'org-1',
      getPermissions: () => [UserPermission.VIEW_MRT],
    };
    const favoriteQueues = [
      { id: 'q-allowed', orgId: 'org-1', name: 'Allowed' },
      { id: 'q-denied', orgId: 'org-1', name: 'Denied' },
    ];

    function makeCtx(opts?: { reviewableQueueIds?: string[]; user?: null }) {
      const reviewableQueueIds = opts?.reviewableQueueIds ?? ['q-allowed'];
      const getFavoriteQueuesForUser = jest.fn(async () => favoriteQueues);
      const getReviewableQueuesForUser = jest.fn(
        async ({ queueIds }: { queueIds?: readonly string[] }) =>
          favoriteQueues.filter(
            (queue) =>
              reviewableQueueIds.includes(queue.id) &&
              (queueIds == null || queueIds.includes(queue.id)),
          ),
      );
      const addFavoriteQueueForUser = jest.fn(async () => undefined);
      const ctx = {
        getUser: () => (opts?.user === null ? null : caller),
        services: {
          ManualReviewToolService: {
            getFavoriteQueuesForUser,
            getReviewableQueuesForUser,
            addFavoriteQueueForUser,
          },
        },
      };
      return {
        ctx,
        getFavoriteQueuesForUser,
        getReviewableQueuesForUser,
        addFavoriteQueueForUser,
      };
    }

    const User = resolvers.User as {
      favoriteMRTQueues: (
        parent: { id: string; orgId: string },
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>;
      reviewableQueues: (
        parent: unknown,
        args: { queueIds?: string[] | null },
        ctx: unknown,
      ) => Promise<unknown>;
    };
    const Mutation = resolvers.Mutation as {
      addFavoriteMRTQueue: (
        parent: unknown,
        args: { queueId: string },
        ctx: unknown,
      ) => Promise<unknown>;
    };

    it("filters the caller's stale favorites through their reviewable queues", async () => {
      const { ctx, getFavoriteQueuesForUser, getReviewableQueuesForUser } =
        makeCtx();

      await expect(
        User.favoriteMRTQueues({ id: 'caller-1', orgId: 'org-1' }, {}, ctx),
      ).resolves.toEqual([favoriteQueues[0]]);
      expect(getFavoriteQueuesForUser).toHaveBeenCalledWith({
        userId: 'caller-1',
        orgId: 'org-1',
      });
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'caller-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-allowed', 'q-denied'],
      });
    });

    it("rejects another user's favorites", async () => {
      const { ctx, getFavoriteQueuesForUser } = makeCtx();
      await expect(
        User.favoriteMRTQueues({ id: 'other-user', orgId: 'org-1' }, {}, ctx),
      ).rejects.toThrow('User does not have access to these queues');
      expect(getFavoriteQueuesForUser).not.toHaveBeenCalled();
    });

    it('rejects favorites from another organization', async () => {
      const { ctx, getFavoriteQueuesForUser } = makeCtx();
      await expect(
        User.favoriteMRTQueues({ id: 'other-user', orgId: 'org-2' }, {}, ctx),
      ).rejects.toThrow('User does not have access to these queues');
      expect(getFavoriteQueuesForUser).not.toHaveBeenCalled();
    });

    it('rejects favoriting a queue the caller cannot review', async () => {
      const { ctx, addFavoriteQueueForUser } = makeCtx();
      await expect(
        Mutation.addFavoriteMRTQueue({}, { queueId: 'q-denied' }, ctx),
      ).rejects.toThrow('User does not have access to this queue');
      expect(addFavoriteQueueForUser).not.toHaveBeenCalled();
    });

    it('allows favoriting a queue the caller can review', async () => {
      const { ctx, addFavoriteQueueForUser } = makeCtx();
      await expect(
        Mutation.addFavoriteMRTQueue({}, { queueId: 'q-allowed' }, ctx),
      ).resolves.toBeDefined();
      expect(addFavoriteQueueForUser).toHaveBeenCalledWith({
        userId: 'caller-1',
        orgId: 'org-1',
        queueId: 'q-allowed',
      });
    });

    it('passes requested queue IDs into the reviewable queue lookup', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: ['q-allowed', 'q-denied'],
      });
      await expect(
        User.reviewableQueues({}, { queueIds: ['q-allowed'] }, ctx),
      ).resolves.toEqual([favoriteQueues[0]]);
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'caller-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-allowed'],
      });
    });
  });
});
