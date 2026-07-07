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

describe('QueueOperations per-reviewer skips', () => {
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
    'a skipped job is hidden from that reviewer but immediately available to others',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

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

      await queueOps.recordReviewerSkip({
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        jobId: xJob.id,
      });

      const aJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-a',
      });
      expect(aJob?.job.payload.item.itemId).toBe('item-Y');

      const bJob = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-b',
      });
      expect(bJob?.job.payload.item.itemId).toBe('item-X');
    },
  );

  testWithQueue()(
    'a queue whose only jobs are skipped returns null instead of hanging',
    async ({ org, queue, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      const onlyJob = await queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        priority: 1000,
        jobPayload: { policyIds: [], payload: payloadFor('item-X') },
      });
      await queueOps.recordReviewerSkip({
        orgId: org.id,
        queueId: queue.id,
        reviewerId: 'reviewer-a',
        jobId: onlyJob.id,
      });

      const result = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-a',
      });
      expect(result).toBeNull();
    },
  );

  testWithQueue()(
    'logSkip hides the job from the skipper and releases their lock in one call',
    async ({ org, queue, user, mrtService }) => {
      const queueOps = mrtService['queueOps'];
      const payloadFor = makePayloadFor(uid());

      await queueOps.addJob({
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

      const first = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: user.id,
      });
      expect(first?.job.payload.item.itemId).toBe('item-X');
      await mrtService.logSkip({
        orgId: org.id,
        queueId: queue.id,
        jobId: first!.job.id,
        userId: user.id,
      });

      const other = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: 'reviewer-b',
      });
      expect(other?.job.payload.item.itemId).toBe('item-X');

      const next = await queueOps.dequeueNextJobWithLock({
        orgId: org.id,
        queueId: queue.id,
        lockToken: user.id,
      });
      expect(next?.job.payload.item.itemId).toBe('item-Y');
    },
  );
});
