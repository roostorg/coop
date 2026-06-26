import fc from 'fast-check';
import { uid } from 'uid';

import getBottle from '../../../iocContainer/index.js';
import createActions from '../../../test/fixtureHelpers/createActions.js';
import createContentItemTypes from '../../../test/fixtureHelpers/createContentItemTypes.js';
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
import {
  bullJobIdtoExternalJobId,
  itemIdToBullJobId,
  parseExternalId,
} from './QueueOperations.js';

describe('QueueOperations', () => {
  it('External ID functions should be inverses of one another', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (itemTypeId, itemId, guid) => {
          const bullId = itemIdToBullJobId({ typeId: itemTypeId, id: itemId });
          const externalId = bullJobIdtoExternalJobId(bullId, guid);
          const inverse = parseExternalId(externalId);
          expect(inverse).toEqual({ bullId, guid });
        },
      ),
    );
  });

  const testWithQueueAndActions = () =>
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
      const { itemTypes, cleanup: itemTypesCleanup } =
        await createContentItemTypes({
          moderationConfigService: container.ModerationConfigService,
          orgId: org.id,
          extra: {
            fields: [
              {
                name: 'someField',
                type: 'NUMBER',
                required: false,
                container: null,
              },
            ],
          },
        });

      const { actions, cleanup: actionsCleanup } = await createActions({
        actionAPI: container.ActionAPIDataSource,
        itemTypeIds: itemTypes.map((it) => it.id),
        orgId: org.id,
        numActions: 3,
      });

      const { queue, cleanup: queuesCleanup } = await createMrtQueue({
        orgId: org.id,
        mrtService: container.ManualReviewToolService,
        userId: user.id,
      });

      return {
        org,
        actions,
        queue,
        user,
        mrtService: container.ManualReviewToolService,
        cleanup: async () => {
          await queuesCleanup();
          await actionsCleanup();
          await itemTypesCleanup();
          await userCleanup();
          await orgCleanup();
          await container.KyselyPg.destroy();
          await container.KyselyPgReadReplica.destroy();
        },
      };
    });

  testWithQueueAndActions()(
    'Queues should default to having no actions hidden',
    async ({ org, queue, mrtService }) => {
      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(hiddenActions.length).toEqual(0);
    },
  );

  testWithQueueAndActions()(
    'Test hiding an action',
    async ({ org, queue, mrtService, actions }) => {
      const actionToHide = actions[Math.floor(Math.random() * actions.length)];
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: [actionToHide.id],
        actionIdsToUnhide: [],
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(1);
      expect(hiddenActions[0]).toEqual(actionToHide.id);
    },
  );

  testWithQueueAndActions()(
    'Test unhiding an action',
    async ({ org, queue, mrtService, actions }) => {
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actions.map((it) => it.id),
        actionIdsToUnhide: [],
      });

      const actionToUnhide =
        actions[Math.floor(Math.random() * actions.length)];
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: [],
        actionIdsToUnhide: [actionToUnhide.id],
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(actions.length - 1);
      expect(hiddenActions).not.toContain(actionToUnhide.id);
    },
  );

  testWithQueueAndActions()(
    'Test hiding some actions and unhiding some others',
    async ({ org, queue, mrtService, actions }) => {
      const actionsToHide = actions.slice(0, 2);
      const actionsToToggle = actions.slice(2, 3);

      // First hide the actions we're going to unhide later
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actionsToToggle.map((it) => it.id),
        actionIdsToUnhide: [],
      });
      const initiallyHiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });
      expect(initiallyHiddenActions.length).toEqual(1);
      expect(initiallyHiddenActions[0]).toEqual(actionsToToggle[0].id);

      // Then unhide the currently hidden actions while hiding others
      await mrtService.updateHiddenActionsForQueue({
        queueId: queue.id,
        orgId: org.id,
        actionIdsToHide: actionsToHide.map((it) => it.id),
        actionIdsToUnhide: actionsToToggle.map((it) => it.id),
      });

      const hiddenActions = await mrtService.getHiddenActionsForQueue({
        orgId: org.id,
        queueId: queue.id,
      });

      expect(hiddenActions.length).toEqual(2);
      expect(
        hiddenActions.every((it) =>
          actionsToHide.map((it) => it.id).includes(it),
        ),
      ).toEqual(true);
      expect(
        hiddenActions.some((it) =>
          actionsToToggle.map((it) => it.id).includes(it),
        ),
      ).toEqual(false);
    },
  );

  // Regression: `deleteAllJobsFromQueue` is irreversible and used to accept
  // EDIT_MRT_QUEUES (held by moderator managers) -- that gap accidentally
  // cleared a production queue. It now requires MANAGE_ORG.
  testWithQueueAndActions()(
    'deleteAllJobsFromQueue rejects EDIT_MRT_QUEUES without MANAGE_ORG',
    async ({ org, queue, mrtService }) => {
      await expect(
        mrtService.deleteAllJobsFromQueue({
          orgId: org.id,
          queueId: queue.id,
          userPermissions: [UserPermission.EDIT_MRT_QUEUES],
        }),
      ).rejects.toMatchObject({ name: 'DeleteAllJobsUnauthorizedError' });
    },
  );

  testWithQueueAndActions()(
    'deleteAllJobsFromQueue accepts MANAGE_ORG',
    async ({ org, queue, mrtService }) => {
      await expect(
        mrtService.deleteAllJobsFromQueue({
          orgId: org.id,
          queueId: queue.id,
          userPermissions: [UserPermission.MANAGE_ORG],
        }),
      ).resolves.toBeUndefined();
    },
  );

  // Regression: recomputePrioritiesForQueue used to fetch jobs only from the
  // 'waiting'/'delayed'/'active' states. Priority-enqueued jobs live in
  // BullMQ's 'prioritized' state, so the recompute was a no-op for them and
  // changing job-priority weights never re-sorted an already-populated queue.
  testWithQueueAndActions()(
    'recomputePrioritiesForQueue re-sorts jobs in the prioritized state',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];

      const payloadFor = (itemId: string): ManualReviewJobPayload => ({
        kind: 'DEFAULT',
        reportHistory: [],
        reportedForReasons: [],
        item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
          submissionId: makeSubmissionId(),
          submissionTime: new Date(),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          data: {} as NormalizedItemData,
          itemTypeIdentifier: {
            id: uid(),
            version: new Date().toISOString(),
            schemaVariant: 'original',
          },
          creator: { id: uid(), typeId: uid() },
          itemId,
        }),
        enqueueSourceInfo: { kind: 'REPORT' },
      });

      // Two jobs added with explicit priorities => both land in the
      // 'prioritized' set. Lower number dequeues first, so initially A < B.
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

      // Swap their priorities. Before the fix this fetched no jobs (they were
      // 'prioritized', not 'waiting') and the order below would still be A.
      await queueOps.recomputePrioritiesForQueue({
        orgId: org.id,
        queueId: queue.id,
        getPriority: async (job) =>
          job.payload.item.itemId === 'item-A' ? 2000 : 1000,
      });

      const first = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });
      expect(first?.job.payload.item.itemId).toBe('item-B');
    },
  );

  // Changing a queue's sort type must re-sort the jobs already in it, not just
  // affect future enqueues. Uses a WEIGHTED -> FIFO switch (FIFO needs no
  // report-count / user-score lookups) and asserts on the resulting BullMQ
  // priority VALUES rather than dequeue order, so the test never depends on how
  // equal-priority ties happen to break.
  testWithQueueAndActions()(
    'updateManualReviewQueue recomputes job priorities when the sort type changes',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const itemTypeId = uid();

      const payloadFor = (itemId: string): ManualReviewJobPayload => ({
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

      // Move the (empty) queue to WEIGHTED first so switching to FIFO below is
      // a real change. Recompute on an empty queue is a no-op, so this needs
      // no external lookups.
      await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'WEIGHTED',
      });

      // Enqueue with distinct explicit priorities.
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

      // Switch to FIFO -> the recompute should reset every queued job to the
      // FIFO priority. Without the recompute they'd keep 1000/2000/3000.
      await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'FIFO',
      });

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
      // FIFO assigns the max BullMQ priority (2_097_152) to every job; equal
      // values prove the sort-type change recomputed the already-queued jobs
      // (they were enqueued with 1000 / 2000 / 3000).
      expect(priorities).toEqual([2_097_152, 2_097_152, 2_097_152]);
    },
  );

  // A skip hides a job from the reviewer who skipped it, while leaving it
  // available to every other reviewer (per-reviewer skip, not a global delay).
  testWithQueueAndActions()(
    'a skipped job is hidden from that reviewer but still available to others',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];

      const payloadFor = (itemId: string): ManualReviewJobPayload => ({
        kind: 'DEFAULT',
        reportHistory: [],
        reportedForReasons: [],
        item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
          submissionId: makeSubmissionId(),
          submissionTime: new Date(),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          data: {} as NormalizedItemData,
          itemTypeIdentifier: {
            id: uid(),
            version: new Date().toISOString(),
            schemaVariant: 'original',
          },
          creator: { id: uid(), typeId: uid() },
          itemId,
        }),
        enqueueSourceInfo: { kind: 'REPORT' },
      });

      // item-X is the top job (lowest priority number), item-Y is next.
      const xJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 2000,
        jobPayload: { policyIds: [], payload: payloadFor('item-Y') },
      });

      const reviewerA = 'reviewer-a';
      const reviewerB = 'reviewer-b';

      // Reviewer A skips item-X.
      await queueOps.recordReviewerSkip({
        orgId: org.id,
        queueId: queue.id,
        reviewerId: reviewerA,
        jobId: xJob.id,
      });

      // A's next dequeue steps past item-X and gets item-Y.
      const aJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: reviewerA,
      });
      expect(aJob?.job.payload.item.itemId).toBe('item-Y');

      // item-X was released back to the pool (delayed-to-now); promote it so
      // it's immediately available, then a DIFFERENT reviewer still gets it.
      const bullQueue = await queueOps['getOrCreateBullQueue']({
        orgId: org.id,
        queueId: queue.id,
      });
      await bullQueue.promoteJobs();

      const bJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: reviewerB,
      });
      expect(bJob?.job.payload.item.itemId).toBe('item-X');
    },
  );
});
