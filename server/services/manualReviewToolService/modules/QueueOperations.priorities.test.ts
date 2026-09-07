import { uid } from 'uid';

import getBottle from '../../../iocContainer/index.js';
import createMrtQueue from '../../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import createUser from '../../../test/fixtureHelpers/createUser.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import { instantiateOpaqueType } from '../../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { UserPermission } from '../../userManagementService/index.js';
import { type ManualReviewJobPayload } from '../manualReviewToolService.js';
import { itemIdToBullJobId } from './QueueOperations.js';

describe('QueueOperations job priorities', () => {
  const testWithQueue = () =>
    makeTestWithFixture(async () => {
      const container = (await getBottle()).container;

      const { org, cleanup: orgCleanup } = await createOrg(
        {
          KyselyPg: container.KyselyPg,
          ModerationConfigService: container.ModerationConfigService,
          ApiKeyService: container.ApiKeyService,
        },
        uid(),
      );

      const { user, cleanup: userCleanup } = await createUser(
        container.KyselyPg,
        org.id,
      );

      const { queue, cleanup: queuesCleanup } = await createMrtQueue({
        orgId: org.id,
        mrtService: container.ManualReviewToolService,
        userId: user.id,
      });

      return {
        org,
        queue,
        user,
        redis: container.IORedis,
        mrtService: container.ManualReviewToolService,
        cleanup: async () => {
          await queuesCleanup();
          await userCleanup();
          await orgCleanup();
          await container.KyselyPg.destroy();
          await container.KyselyPgReadReplica.destroy();
        },
      };
    });

  testWithQueue()(
    'a sort-mode change releases the lock when the sweep finishes',
    async ({ org, queue, user, redis, mrtService }) => {
      const lockKey = `{${org.id}}:mrt-recompute-lock:${queue.id}`;

      await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'NUM_REPORTS',
      });

      await mrtService.awaitPendingPriorityRecomputes();

      expect(await redis.get(lockKey)).toBeNull();
    },
  );

  testWithQueue()(
    'a sweep waits for another instance instead of being dropped',
    async ({ org, queue, user, redis, mrtService }) => {
      const lockKey = `{${org.id}}:mrt-recompute-lock:${queue.id}`;
      await redis.set(lockKey, 'held-by-another-instance', 'PX', 30_000);

      const updated = await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'NUM_REPORTS',
      });

      expect(updated.jobSortType).toBe('NUM_REPORTS');
      expect(await redis.get(lockKey)).toBe('held-by-another-instance');

      await redis.del(lockKey);
      await mrtService.awaitPendingPriorityRecomputes();

      expect(await redis.get(lockKey)).toBeNull();
    },
  );

  testWithQueue()(
    'an appeals queue stays FIFO even when a sort mode is requested',
    async ({ org, user, mrtService }) => {
      const invokedBy = {
        userId: user.id,
        permissions: [UserPermission.EDIT_MRT_QUEUES],
        orgId: org.id,
      };

      const appealsQueue = await mrtService.createManualReviewQueue({
        name: `appeals-${uid()}`,
        description: null,
        userIds: [user.id],
        hiddenActionIds: [],
        isAppealsQueue: true,
        jobSortType: 'NUM_REPORTS',
        invokedBy,
      });
      expect(appealsQueue.jobSortType).toBe('FIFO');

      const updated = await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: appealsQueue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'NUM_REPORTS',
      });
      expect(updated.jobSortType).toBe('FIFO');

      await mrtService.deleteManualReviewQueueForTestsDO_NOT_USE(
        org.id,
        appealsQueue.id,
      );
    },
  );

  const makePayloadFor =
    (itemTypeId: string) =>
    (itemId: string): ManualReviewJobPayload => ({
      kind: 'DEFAULT',
      reportHistory: [],
      reportedForReasons: [],
      item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: {} as NormalizedItemData,
        itemTypeIdentifier: {
          id: itemTypeId,
          version: new Date().toISOString(),
          schemaVariant: 'original',
        },
        creator: { id: uid(), typeId: uid() },
        itemId,
      }),
      enqueueSourceInfo: { kind: 'REPORT' },
    });

  testWithQueue()(
    'recomputePrioritiesForQueue re-sorts jobs in the prioritized state',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-A') },
      });
      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 2000,
        jobPayload: { policyIds: [], payload: payloadFor('item-B') },
      });

      await queueOps.recomputePrioritiesForQueue({
        orgId: org.id,
        queueId: queue.id,
        getPriorities: async (itemIds) =>
          new Map(
            itemIds.map((itemId) => [
              itemId,
              itemId === 'item-A' ? 2000 : 1000,
            ]),
          ),
      });

      const first = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-1',
      });
      expect(first?.job.payload.item.itemId).toBe('item-B');
    },
  );

  testWithQueue()(
    'updateManualReviewQueue recomputes job priorities when the sort type changes',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const itemTypeId = uid();
      const payloadFor = makePayloadFor(itemTypeId);

      const items: Array<[string, number]> = [
        ['item-A', 1000],
        ['item-B', 2000],
        ['item-C', 3000],
      ];
      for (const [itemId, priority] of items) {
        await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          priority,
          jobPayload: { policyIds: [], payload: payloadFor(itemId) },
        });
      }

      await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'NUM_REPORTS',
      });
      await mrtService.awaitPendingPriorityRecomputes();

      const bullQueue = await queueOps['getOrCreateBullQueue']({
        orgId: org.id,
        queueId: queue.id,
      });
      const priorities = await Promise.all(
        items.map(async ([itemId]) => {
          const job = await bullQueue.getJob(
            itemIdToBullJobId({ typeId: itemTypeId, id: itemId }),
          );
          return job?.priority;
        }),
      );
      expect(priorities).toEqual([2_097_151, 2_097_151, 2_097_151]);
    },
  );

  testWithQueue()(
    'switching a queue back to FIFO restores arrival order',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      const setSortType = async (jobSortType: 'FIFO' | 'NUM_REPORTS') => {
        await mrtService.updateManualReviewQueue({
          orgId: org.id,
          queueId: queue.id,
          userIds: [user.id],
          actionIdsToHide: [],
          actionIdsToUnhide: [],
          jobSortType,
        });
        await mrtService.awaitPendingPriorityRecomputes();
      };

      await setSortType('NUM_REPORTS');

      const base = new Date('2026-01-01T00:00:00.000Z').getTime();
      const arrivalOrder = ['item-E', 'item-D', 'item-C', 'item-B', 'item-A'];
      const priorityByItem: Record<string, number> = {
        'item-E': 2000,
        'item-D': 3000,
        'item-C': 1000,
        'item-B': 4000,
        'item-A': 5000,
      };
      for (const [index, itemId] of arrivalOrder.entries()) {
        await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          priority: priorityByItem[itemId],
          jobPayload: {
            createdAt: new Date(base + index * 1000),
            policyIds: [],
            payload: payloadFor(itemId),
          },
        });
      }

      await setSortType('FIFO');

      let dequeued: string[] = [];
      for (let i = 0; i < arrivalOrder.length; i++) {
        const next = await queueOps.dequeueNextJobWithLock({
          orgId: org.id,
          queueId: queue.id,
          lockToken: 'reviewer-1',
        });
        dequeued = [...dequeued, next?.job.payload.item.itemId ?? '(none)'];
      }
      expect(dequeued).toEqual(arrivalOrder);
    },
  );

  testWithQueue()(
    'a FIFO queue leaves its jobs in the wait list, not the prioritized set',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      for (const itemId of ['item-A', 'item-B']) {
        await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          jobPayload: { policyIds: [], payload: payloadFor(itemId) },
        });
      }

      const bullQueue = await queueOps['getOrCreateBullQueue']({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(await bullQueue.getJobCountByTypes('prioritized')).toBe(0);
      expect(await bullQueue.getJobCountByTypes('waiting')).toBe(2);

      const oldest = await queueOps.getOldestJobCreatedAt({
        orgId: org.id,
        queueId: queue.id,
        isAppealsQueue: false,
      });
      expect(oldest).not.toBeNull();
    },
  );

  testWithQueue()(
    'getOldestJobCreatedAt finds the oldest job on a prioritized queue',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      const base = new Date('2026-01-01T00:00:00.000Z').getTime();
      const oldestCreatedAt = new Date(base);

      const jobs: Array<[string, number, Date]> = [
        ['item-oldest', 5000, oldestCreatedAt],
        ['item-middle', 3000, new Date(base + 60_000)],
        ['item-newest', 1000, new Date(base + 120_000)],
      ];
      for (const [itemId, priority, createdAt] of jobs) {
        await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          priority,
          jobPayload: { createdAt, policyIds: [], payload: payloadFor(itemId) },
        });
      }

      const bullQueue = await queueOps['getOrCreateBullQueue']({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(await bullQueue.getJobCountByTypes('waiting')).toBe(0);
      expect(await bullQueue.getJobCountByTypes('prioritized')).toBe(3);

      const oldest = await queueOps.getOldestJobCreatedAt({
        orgId: org.id,
        queueId: queue.id,
        isAppealsQueue: false,
      });
      expect(oldest).not.toBeNull();
      expect(new Date(oldest!).getTime()).toBe(oldestCreatedAt.getTime());
    },
  );
});
