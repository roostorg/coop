import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './manualReviewTool.js';

type ResolverFn = (
  parent: unknown,
  args: unknown,
  ctx: unknown,
) => Promise<unknown>;

const Query = resolvers.Query as Record<
  'getTotalPendingJobsCount' | 'manualReviewQueue' | 'getExistingJobsForItem',
  ResolverFn
>;
const Mutation = resolvers.Mutation as Record<
  'dequeueManualReviewJob' | 'submitManualReviewDecision',
  ResolverFn
>;
const ManualReviewQueue = resolvers.ManualReviewQueue as Record<
  | 'jobs'
  | 'pendingJobCount'
  | 'oldestJobCreatedAt'
  | 'explicitlyAssignedReviewers'
  | 'hiddenActionIds'
  | 'clearReportsTriggerActionIds',
  ResolverFn
>;

function makeCtx(opts: {
  reviewableQueueIds: string[];
  user?: {
    id: string;
    orgId: string;
    permissions: readonly UserPermission[];
    email?: string;
  } | null;
}) {
  const user =
    opts.user === undefined
      ? { id: 'user-1', orgId: 'org-1', permissions: [UserPermission.VIEW_MRT] }
      : opts.user;

  const getReviewableQueuesForUser = jest.fn(
    async ({ queueIds }: { queueIds?: readonly string[] }) =>
      opts.reviewableQueueIds
        .filter((id) => queueIds == null || queueIds.includes(id))
        .map((id) => ({ id, orgId: 'org-1', name: id })),
  );
  const getAllQueuesForOrgAndDangerouslyBypassPermissioning = jest.fn(
    async () => {
      throw new Error('resolver must not bypass permissioning (#1150)');
    },
  );
  const getQueueForOrgAndDangerouslyBypassPermissioning = jest.fn(async () => {
    throw new Error('resolver must not bypass permissioning');
  });
  const getTotalPendingJobCountForQueues = jest.fn(async () => 7);
  const dequeueNextJob = jest.fn(async () => null);
  const submitDecision = jest.fn(async () => ({ warnings: [] }));
  const getAllJobsForQueue = jest.fn(async () => []);
  const getJobsForQueue = jest.fn(async () => []);
  const getExistingJobsForItem = jest.fn(async () => []);
  const getPendingJobCount = jest.fn(async () => 3);
  const getOldestJobCreatedAt = jest.fn(async () => new Date(0));
  const getUsersWhoCanSeeQueue = jest.fn(
    async (): Promise<{ userId: string }[]> => [],
  );
  const getHiddenActionsForQueue = jest.fn(async (): Promise<string[]> => [
    'action-1',
  ]);
  const getClearReportsTriggerActionsForQueue = jest.fn(
    async (): Promise<string[]> => [],
  );
  const getGraphQLUsersFromIds = jest.fn(async (): Promise<unknown[]> => []);

  const ctx = {
    getUser: () =>
      user == null
        ? null
        : {
            id: user.id,
            orgId: user.orgId,
            email: user.email ?? 'user@example.com',
            getPermissions: () => user.permissions,
          },
    services: {
      ManualReviewToolService: {
        getReviewableQueuesForUser,
        getAllQueuesForOrgAndDangerouslyBypassPermissioning,
        getQueueForOrgAndDangerouslyBypassPermissioning,
        getTotalPendingJobCountForQueues,
        dequeueNextJob,
        submitDecision,
        getAllJobsForQueue,
        getJobsForQueue,
        getExistingJobsForItem,
        getPendingJobCount,
        getOldestJobCreatedAt,
        getUsersWhoCanSeeQueue,
        getHiddenActionsForQueue,
        getClearReportsTriggerActionsForQueue,
      },
    },
    dataSources: {
      userAPI: { getGraphQLUsersFromIds },
    },
  };

  return {
    ctx,
    getReviewableQueuesForUser,
    getAllQueuesForOrgAndDangerouslyBypassPermissioning,
    getQueueForOrgAndDangerouslyBypassPermissioning,
    getTotalPendingJobCountForQueues,
    dequeueNextJob,
    submitDecision,
    getAllJobsForQueue,
    getJobsForQueue,
    getExistingJobsForItem,
    getPendingJobCount,
    getOldestJobCreatedAt,
    getUsersWhoCanSeeQueue,
    getHiddenActionsForQueue,
    getClearReportsTriggerActionsForQueue,
    getGraphQLUsersFromIds,
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
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: ['q-1', 'q-2'],
      });
      await expect(
        Query.manualReviewQueue({}, { id: 'q-2' }, ctx),
      ).resolves.toMatchObject({ id: 'q-2' });
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-2'],
      });
    });

    it('returns null for a queue the caller is not a member of', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getQueueForOrgAndDangerouslyBypassPermissioning,
      } = makeCtx({ reviewableQueueIds: ['q-1'] });
      await expect(
        Query.manualReviewQueue({}, { id: 'q-forbidden' }, ctx),
      ).resolves.toBeNull();
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-forbidden'],
      });
      expect(
        getQueueForOrgAndDangerouslyBypassPermissioning,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Query.getExistingJobsForItem', () => {
    it('searches only the queues the caller can review, never all org queues', async () => {
      const { ctx, getReviewableQueuesForUser, getExistingJobsForItem } =
        makeCtx({ reviewableQueueIds: ['q-1', 'q-2'] });

      await expect(
        Query.getExistingJobsForItem(
          {},
          { itemId: 'item-1', itemTypeId: 'content' },
          ctx,
        ),
      ).resolves.toEqual([]);

      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
      });
      expect(getExistingJobsForItem).toHaveBeenCalledWith({
        orgId: 'org-1',
        itemId: 'item-1',
        itemTypeId: 'content',
        queueIds: ['q-1', 'q-2'],
      });
    });

    it('searches nothing for a caller with no reviewable queues', async () => {
      const { ctx, getExistingJobsForItem } = makeCtx({
        reviewableQueueIds: [],
        user: {
          id: 'user-1',
          orgId: 'org-1',
          permissions: [],
        },
      });

      await expect(
        Query.getExistingJobsForItem(
          {},
          { itemId: 'item-1', itemTypeId: 'content' },
          ctx,
        ),
      ).resolves.toEqual([]);

      expect(getExistingJobsForItem).toHaveBeenCalledWith({
        orgId: 'org-1',
        itemId: 'item-1',
        itemTypeId: 'content',
        queueIds: [],
      });
    });

    it('throws when there is no authenticated user', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(
        Query.getExistingJobsForItem(
          {},
          { itemId: 'item-1', itemTypeId: 'content' },
          ctx,
        ),
      ).rejects.toThrow('Authenticated user required');
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.dequeueManualReviewJob', () => {
    it('rejects a dequeue against a queue the caller cannot review', async () => {
      const { ctx, getReviewableQueuesForUser, dequeueNextJob } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        Mutation.dequeueManualReviewJob({}, { queueId: 'q-forbidden' }, ctx),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-forbidden'],
      });
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

  describe('Mutation.submitManualReviewDecision', () => {
    it('throws when there is no authenticated user', async () => {
      const { ctx, submitDecision } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(
        Mutation.submitManualReviewDecision({}, { input: {} }, ctx),
      ).rejects.toThrow('User required.');
      expect(submitDecision).not.toHaveBeenCalled();
    });

    it('rejects a decision after queue access is revoked', async () => {
      const { ctx, submitDecision } = makeCtx({
        reviewableQueueIds: [],
      });
      await expect(
        Mutation.submitManualReviewDecision(
          {},
          { input: { queueId: 'q-revoked' } },
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(submitDecision).not.toHaveBeenCalled();
    });

    it('submits a decision for a queue the caller can review', async () => {
      const { ctx, submitDecision } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        Mutation.submitManualReviewDecision(
          {},
          {
            input: {
              queueId: 'q-1',
              jobId: 'job-1',
              lockToken: 'lock-1',
              reportedItemDecisionComponents: [{ ignore: { _: true } }],
              relatedItemActions: [],
              reportHistory: [],
              decisionReason: null,
            },
          },
          ctx,
        ),
      ).resolves.toEqual({
        __typename: 'SubmitDecisionSuccessResponse',
        success: true,
        warnings: [],
      });
      expect(submitDecision).toHaveBeenCalledWith({
        reportHistory: [],
        queueId: 'q-1',
        jobId: 'job-1',
        lockToken: 'lock-1',
        decisionComponents: [{ type: 'IGNORE' }],
        relatedActions: [],
        reviewerId: 'user-1',
        reviewerEmail: 'user@example.com',
        orgId: 'org-1',
        decisionReason: undefined,
      });
    });
  });

  describe('ManualReviewQueue queue-scoped fields authorize their parent', () => {
    const jobsArgs = { ids: null, limit: null };

    it('jobs throws when there is no authenticated user', async () => {
      const { ctx, getAllJobsForQueue } = makeCtx({
        reviewableQueueIds: [],
        user: null,
      });
      await expect(
        ManualReviewQueue.jobs({ orgId: 'org-1', id: 'q-1' }, jobsArgs, ctx),
      ).rejects.toThrow('User required.');
      expect(getAllJobsForQueue).not.toHaveBeenCalled();
    });

    it('jobs returns jobs for a queue the caller can review', async () => {
      const { ctx, getAllJobsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.jobs({ orgId: 'org-1', id: 'q-1' }, jobsArgs, ctx),
      ).resolves.toEqual([]);
      expect(getAllJobsForQueue).toHaveBeenCalled();
    });

    it('jobs refuses a queue reachable only through a stale favorite', async () => {
      const { ctx, getAllJobsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.jobs(
          { orgId: 'org-1', id: 'q-revoked' },
          jobsArgs,
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getAllJobsForQueue).not.toHaveBeenCalled();
    });

    it('jobs allows a queue manager without a separate VIEW_MRT permission', async () => {
      const { ctx, getAllJobsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
        user: {
          id: 'user-1',
          orgId: 'org-1',
          permissions: [
            UserPermission.EDIT_MRT_QUEUES,
            UserPermission.MANAGE_ROUTING_RULES,
          ],
        },
      });
      await expect(
        ManualReviewQueue.jobs({ orgId: 'org-1', id: 'q-1' }, jobsArgs, ctx),
      ).resolves.toEqual([]);
      expect(getAllJobsForQueue).toHaveBeenCalled();
    });

    it('jobs refuses a queue belonging to another org', async () => {
      const { ctx, getAllJobsForQueue, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.jobs({ orgId: 'org-2', id: 'q-1' }, jobsArgs, ctx),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getAllJobsForQueue).not.toHaveBeenCalled();
      expect(getReviewableQueuesForUser).not.toHaveBeenCalled();
    });

    it('pendingJobCount refuses a queue the caller cannot review', async () => {
      const { ctx, getPendingJobCount } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.pendingJobCount(
          { orgId: 'org-1', id: 'q-revoked' },
          {},
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getPendingJobCount).not.toHaveBeenCalled();
    });

    it('oldestJobCreatedAt refuses a queue the caller cannot review', async () => {
      const { ctx, getOldestJobCreatedAt } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.oldestJobCreatedAt(
          { orgId: 'org-1', id: 'q-revoked' },
          {},
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getOldestJobCreatedAt).not.toHaveBeenCalled();
    });

    it('batches queue authorization across concurrent fields', async () => {
      const { ctx, getReviewableQueuesForUser } = makeCtx({
        reviewableQueueIds: ['q-1', 'q-2'],
      });

      await Promise.all([
        ManualReviewQueue.jobs({ orgId: 'org-1', id: 'q-1' }, jobsArgs, ctx),
        ManualReviewQueue.pendingJobCount(
          { orgId: 'org-1', id: 'q-1' },
          {},
          ctx,
        ),
        ManualReviewQueue.oldestJobCreatedAt(
          { orgId: 'org-1', id: 'q-2' },
          {},
          ctx,
        ),
      ]);

      expect(getReviewableQueuesForUser).toHaveBeenCalledTimes(1);
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-1', 'q-2'],
      });
    });

    it('preserves allowed and denied results within one authorization batch', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getPendingJobCount,
        getOldestJobCreatedAt,
      } = makeCtx({ reviewableQueueIds: ['q-allowed'] });

      const results = await Promise.allSettled([
        ManualReviewQueue.pendingJobCount(
          { orgId: 'org-1', id: 'q-allowed' },
          {},
          ctx,
        ),
        ManualReviewQueue.oldestJobCreatedAt(
          { orgId: 'org-1', id: 'q-denied' },
          {},
          ctx,
        ),
      ]);

      expect(results[0]).toMatchObject({ status: 'fulfilled', value: 3 });
      expect(results[1]).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({
          message: 'User does not have access to this queue',
        }),
      });
      expect(getReviewableQueuesForUser).toHaveBeenCalledTimes(1);
      expect(getReviewableQueuesForUser).toHaveBeenCalledWith({
        invoker: {
          userId: 'user-1',
          permissions: [UserPermission.VIEW_MRT],
          orgId: 'org-1',
        },
        queueIds: ['q-allowed', 'q-denied'],
      });
      expect(getPendingJobCount).toHaveBeenCalled();
      expect(getOldestJobCreatedAt).not.toHaveBeenCalled();
    });

    it('explicitlyAssignedReviewers refuses a queue the caller cannot review', async () => {
      const { ctx, getUsersWhoCanSeeQueue, getGraphQLUsersFromIds } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.explicitlyAssignedReviewers(
          { orgId: 'org-1', id: 'q-revoked' },
          {},
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getUsersWhoCanSeeQueue).not.toHaveBeenCalled();
      expect(getGraphQLUsersFromIds).not.toHaveBeenCalled();
    });

    it('explicitlyAssignedReviewers lists reviewers for a queue the caller can review', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getUsersWhoCanSeeQueue,
        getGraphQLUsersFromIds,
      } = makeCtx({ reviewableQueueIds: ['q-1', 'q-2'] });

      getUsersWhoCanSeeQueue.mockResolvedValue([{ userId: 'user-2' }]);
      getGraphQLUsersFromIds.mockResolvedValue([{ id: 'user-2' }]);

      await expect(
        ManualReviewQueue.explicitlyAssignedReviewers(
          { orgId: 'org-1', id: 'q-2' },
          {},
          ctx,
        ),
      ).resolves.toEqual([{ id: 'user-2' }]);
      expect(getReviewableQueuesForUser).toHaveBeenCalledTimes(1);
    });

    it('hiddenActionIds refuses a queue the caller cannot review', async () => {
      const { ctx, getHiddenActionsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.hiddenActionIds(
          { orgId: 'org-1', id: 'q-revoked' },
          {},
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getHiddenActionsForQueue).not.toHaveBeenCalled();
    });

    it('hiddenActionIds returns actions for a queue the caller can review', async () => {
      const { ctx, getHiddenActionsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.hiddenActionIds(
          { orgId: 'org-1', id: 'q-1' },
          {},
          ctx,
        ),
      ).resolves.toEqual(['action-1']);
      expect(getHiddenActionsForQueue).toHaveBeenCalledWith({
        orgId: 'org-1',
        queueId: 'q-1',
      });
    });

    it('clearReportsTriggerActionIds refuses a queue the caller cannot review', async () => {
      const { ctx, getClearReportsTriggerActionsForQueue } = makeCtx({
        reviewableQueueIds: ['q-1'],
      });
      await expect(
        ManualReviewQueue.clearReportsTriggerActionIds(
          { orgId: 'org-1', id: 'q-revoked' },
          {},
          ctx,
        ),
      ).rejects.toThrow('User does not have access to this queue');
      expect(getClearReportsTriggerActionsForQueue).not.toHaveBeenCalled();
    });

    it('clearReportsTriggerActionIds returns actions for a queue the caller can review', async () => {
      const {
        ctx,
        getReviewableQueuesForUser,
        getClearReportsTriggerActionsForQueue,
      } = makeCtx({ reviewableQueueIds: ['q-1'] });

      getClearReportsTriggerActionsForQueue.mockResolvedValue(['trigger-1']);

      await expect(
        ManualReviewQueue.clearReportsTriggerActionIds(
          { orgId: 'org-1', id: 'q-1' },
          {},
          ctx,
        ),
      ).resolves.toEqual(['trigger-1']);
      expect(getReviewableQueuesForUser).toHaveBeenCalledTimes(1);
    });
  });
});
