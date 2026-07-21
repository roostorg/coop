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
import { type ManualReviewJobPayload } from '../manualReviewToolService.js';
import { toBullPriority } from './JobPriority.js';
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

  // A DEFAULT-kind job payload, parameterized only by item type and item id.
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

      // Priority-enqueued jobs live in BullMQ's 'prioritized' state, not
      // 'waiting'; the recompute must fetch them there. Lower number dequeues
      // first, so initially A comes before B.
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

      // Swap the two priorities, then confirm the swap took effect by
      // dequeuing: B must now come out first.
      await queueOps.recomputePrioritiesForQueue({
        orgId: org.id,
        queueId: queue.id,
        getPriority: async (job) =>
          job.payload.item.itemId === 'item-A' ? 2000 : 1000,
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

      // Enqueue with distinct explicit priorities, as if stamped under some
      // earlier sort mode.
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

      // Switching the sort mode must re-stamp jobs already in the queue, not
      // just future enqueues. With no reports recorded, NUM_REPORTS maps every
      // job to the same max priority.
      await mrtService.updateManualReviewQueue({
        orgId: org.id,
        queueId: queue.id,
        userIds: [user.id],
        actionIdsToHide: [],
        actionIdsToUnhide: [],
        jobSortType: 'NUM_REPORTS',
      });
      // The re-stamp runs in the background after the mutation returns.
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
      // All three re-stamped to the same max priority proves the switch
      // recomputed the queued jobs (they would otherwise keep 1000/2000/3000).
      expect(priorities).toEqual([2_097_151, 2_097_151, 2_097_151]);
    },
  );

  testWithQueue()(
    'switching to a constant priority restores arrival order (FIFO)',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      // Five jobs arrive in this order (distinct createdAt timestamps), with
      // priorities that put them in a completely different dequeue order. The
      // arrival order is also the reverse of the ids' lexicographic order, so
      // neither the priority stamps nor any incidental id ordering can
      // accidentally produce the expected result.
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

      // Re-stamp every job with FIFO's constant priority. Ties must resolve
      // to arrival order, which is exactly what a NUM_REPORTS -> FIFO switch
      // relies on.
      await queueOps.recomputePrioritiesForQueue({
        orgId: org.id,
        queueId: queue.id,
        getPriority: async () => toBullPriority(0),
      });

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
});
