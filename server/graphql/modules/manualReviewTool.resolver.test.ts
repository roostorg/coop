import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './manualReviewTool.js';

type ResolverFn = (
  parent: unknown,
  args: unknown,
  ctx: unknown,
) => Promise<unknown>;

const Query = resolvers.Query as Record<
  'getTotalPendingJobsCount' | 'manualReviewQueue',
  ResolverFn
>;
const Mutation = resolvers.Mutation as Record<
  'dequeueManualReviewJob',
  ResolverFn
>;
const ManualReviewQueue = resolvers.ManualReviewQueue as Record<
  'jobs',
  ResolverFn
>;

function makeCtx(opts: {
  reviewableQueueIds: string[];
  user?: {
    id: string;
    orgId: string;
    permissions: readonly UserPermission[];
  } | null;
}) {
  const user =
    opts.user === undefined
      ? { id: 'user-1', orgId: 'org-1', permissions: [UserPermission.VIEW_MRT] }
      : opts.user;

  const getReviewableQueuesForUser = jest.fn(async () =>
    opts.reviewableQueueIds.map((id) => ({ id, orgId: 'org-1', name: id })),
  );
  const getAllQueuesForOrgAndDangerouslyBypassPermissioning = jest.fn(
    async () => {
      throw new Error('resolver must not bypass permissioning (#1150)');
    },
  );
  const getQueueForOrgAndDangerouslyBypassPermissioning = jest.fn(async () => {
    throw new Error('resolver must not bypass permissioning (#1150)');
  });
  const getTotalPendingJobCountForQueues = jest.fn(async () => 7);
  const dequeueNextJob = jest.fn(async () => null);
  const getAllJobsForQueue = jest.fn(async () => []);

  const ctx = {
    getUser: () =>
      user == null
        ? null
        : {
            id: user.id,
            orgId: user.orgId,
            getPermissions: () => user.permissions,
          },
    services: {
      ManualReviewToolService: {
        getReviewableQueuesForUser,
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
        getQueueForOrgAndDangerouslyBypassPermissioning,
        getTotalPendingJobCountForQueues,
        dequeueNextJob,
        getAllJobsForQueue,
      },
    },
  };

  return {
    ctx,
    getReviewableQueuesForUser,
    getAllQueuesForOrgAndDangerouslyBypassPermissioning,
    getQueueForOrgAndDangerouslyBypassPermissioning,
    getTotalPendingJobCountForQueues,
    dequeueNextJob,
    getAllJobsForQueue,
  };
}

describe('MRT queue/job resolvers are membership-scoped', () => {
  describe('Query.getTotalPendingJobsCount', () => {
    it('counts only the queues the caller can review, never all org queues', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
        getTotalPendingJobCountForQueues,
      } = makeCtx({ reviewableQueueIds: ['q-1', 'q-2'] });

      await expect(Query.getTotalPendingJobsCount({}, {}, ctx)).resolves.toBe(
        7,
      );

      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
      });
      expect(getTotalPendingJobCountForQueues).toHaveBeenCalledWith('org-1', [
        'q-1',
        'q-2',
      ]);
      expect(
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
      ).not.toHaveBeenCalled();
    });

    it('throws when there is no authenticated user', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(Query.getTotalPendingJobsCount({}, {}, ctx)).rejects.toThrow(
        'Authenticated user required',
      );
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });
  });

  describe('Query.manualReviewQueue', () => {
    it('returns a queue the caller can review', async () => {
      const { ctx } = makeCtx({ reviewableQueueIds: ['q-1', 'q-2'] });
      await expect(
        Query.manualReviewQueue({}, { id: 'q-2' }, ctx),
      ).resolves.toMatchObject({ id: 'q-2' });
    });

    it('returns null for a queue the caller is not a member of', async () => {
      const { ctx, getQueueForOrgAndDangerouslyBypassPermissioning } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        Query.manualReviewQueue({}, { id: 'q-forbidden' }, ctx),
      ).resolves.toBeNull();
      expect(
        getQueueForOrgAndDangerouslyBypassPermissioning,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.dequeueManualReviewJob', () => {
    it('rejects a dequeue against a queue the caller cannot review', async () => {
      const { ctx, dequeueNextJob } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        Mutation.dequeueManualReviewJob({}, { queueId: 'q-forbidden' }, ctx),
      ).rejects.toThrow('User does not have access to this queue');
      expect(dequeueNextJob).not.toHaveBeenCalled();
    });

    it('allows a dequeue against a queue the caller can review', async () => {
      const { ctx, dequeueNextJob } = makeCtx({
        reviewableQueueIds: ['q-1', 'q-2'],
      });
      await expect(
        Mutation.dequeueManualReviewJob({}, { queueId: 'q-2' }, ctx),
      ).resolves.toBeNull();
      expect(dequeueNextJob).toHaveBeenCalledWith({
        orgId: 'org-1',
        queueId: 'q-2',
        userId: 'user-1',
      });
    });

    it('throws when there is no authenticated user', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(
        Mutation.dequeueManualReviewJob({}, { queueId: 'q-1' }, ctx),
      ).rejects.toThrow('User required.');
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });
  });

  describe('ManualReviewQueue.jobs', () => {
    it('throws when there is no authenticated user', async () => {
      const { ctx, getAllJobsForQueue } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(
        ManualReviewQueue.jobs(
          { orgId: 'org-1', id: 'q-1' },
          { ids: null, limit: null },
          ctx,
        ),
      ).rejects.toThrow('User required.');
      expect(getAllJobsForQueue).not.toHaveBeenCalled();
    });
  });
});
