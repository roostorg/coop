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
import { toBullPriority } from './JobPriority.js';
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

  // Shared DEFAULT-kind job payload, parameterized only by item type and id.
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

  // Regression: deleteAllJobsFromQueue now requires MANAGE_ORG (was the weaker
  // EDIT_MRT_QUEUES, which accidentally let a manager clear a production queue).
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

  // Regression: recompute used to skip BullMQ's 'prioritized' state, so weight
  // changes never re-sorted already-enqueued (priority) jobs.
  testWithQueueAndActions()(
    'recomputePrioritiesForQueue re-sorts jobs in the prioritized state',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];

      const payloadFor = makePayloadFor(uid());

      // Both land in 'prioritized'; lower number dequeues first, so initially A < B.
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

      // Swap priorities; before the fix this fetched no jobs and order stayed A.
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

  // Changing sort type must re-sort jobs already queued, not just future ones.
  // Asserts on priority VALUES (not dequeue order) so it never depends on ties.
  testWithQueueAndActions()(
    'updateManualReviewQueue recomputes job priorities when the sort type changes',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const itemTypeId = uid();

      const payloadFor = makePayloadFor(itemTypeId);

      // Move the empty queue to WEIGHTED first so the FIFO switch below is a real change.
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

      // Switch to FIFO: recompute resets every queued job (else they keep 1000/2000/3000).
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
      // Equal max priority on all three proves the switch recomputed queued jobs.
      expect(priorities).toEqual([2_097_151, 2_097_151, 2_097_151]);
    },
  );

  // FIFO ties every job on priority, so order is the recompute's tiebreak
  // counter, which must re-stamp oldest-createdAt first to preserve arrival
  // order on a mode switch. Reads the ZSET directly (no worker) for determinism.
  testWithQueueAndActions()(
    'recomputePrioritiesForQueue breaks priority ties by createdAt (oldest first)',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const itemTypeId = uid();

      const payloadFor = makePayloadFor(itemTypeId);

      const base = new Date('2026-01-01T00:00:00.000Z').getTime();
      // Arrival order is the REVERSE of lexicographic id order, so a fallback to
      // Redis's member order (not the createdAt re-stamp) yields A..E.
      const arrival = ['item-E', 'item-D', 'item-C', 'item-B', 'item-A'];
      const createdAtByItem = Object.fromEntries(
        arrival.map((itemId, i): [string, number] => [itemId, base + i * 1000]),
      );
      // Enqueue in scrambled order with scrambled priorities.
      const inserts: Array<[string, number]> = [
        ['item-C', 1000],
        ['item-A', 5000],
        ['item-E', 2000],
        ['item-B', 4000],
        ['item-D', 3000],
      ];
      for (const [itemId, priority] of inserts) {
        await queueOps.addJob({
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
          priority,
          jobPayload: {
            createdAt: new Date(createdAtByItem[itemId]),
            policyIds: [],
            payload: payloadFor(itemId),
          },
        });
      }

      // Re-stamp through FIFO's real ceiling (toBullPriority(0)) so a regression
      // to 2^21 — which collapses counters at the float64 2^53 boundary, see
      // JobPriority.ts — fails here. Constant priority => pure createdAt tiebreak.
      await queueOps.recomputePrioritiesForQueue({
        orgId: org.id,
        queueId: queue.id,
        getPriority: async () => toBullPriority(0),
      });

      // Read the prioritized ZSET directly: ascending score == dequeue order.
      const redis = queueOps['redis'];
      const withScores = await redis.zrange(
        `{${org.id}}:${queue.id}:prioritized`,
        0,
        -1,
        'WITHSCORES',
      );
      const members = withScores.filter((_, i) => i % 2 === 0);
      const scores = withScores.filter((_, i) => i % 2 === 1).map(Number);
      const ordered = members.map(
        (member) =>
          arrival.find(
            (itemId) =>
              itemIdToBullJobId({ typeId: itemTypeId, id: itemId }) === member,
          ) ?? member,
      );
      // Dequeue order must equal arrival order (NOT id order), and every score
      // must be distinct (a 2^53 float64 collapse would tie adjacent counters).
      expect(ordered).toEqual(arrival);
      expect(new Set(scores).size).toBe(scores.length);
    },
  );

  // A skip hides a job from the skipping reviewer but leaves it for others.
  testWithQueueAndActions()(
    'a skipped job is hidden from that reviewer but still available to others',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];

      const payloadFor = makePayloadFor(uid());

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

      // A different reviewer immediately gets item-X: the skip released it back
      // to the shared pool, and B's getNextJob promotes and serves it.
      const bJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: reviewerB,
      });
      expect(bJob?.job.payload.item.itemId).toBe('item-X');
    },
  );
});
