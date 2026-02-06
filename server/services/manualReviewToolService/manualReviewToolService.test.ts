import { v1 as uuidv1 } from 'uuid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  type ManualReviewToolService,
  type ReportHistory,
} from './manualReviewToolService.js';

describe('Manual Review Tool Service', () => {
  let mrtService: ManualReviewToolService;
  let container: Dependencies;

  beforeAll(async () => {
    // The mutation should be ok here since this is initial setup in a
    // beforeAll; it doesn't involve reset state for each test in the suite
    /* eslint-disable better-mutation/no-mutation */
    ({ container } = await getBottle());
    mrtService = container.ManualReviewToolService;
    /* eslint-enable better-mutation/no-mutation */
  });

  afterAll(async () => {
    await container.closeSharedResourcesForShutdown();
  });

  // Test that we can start the stalled jobs checker for manual job processing
  test('should be able to start stalled jobs checker', async () => {
    const worker = await mrtService['queueOps']['getBullWorker']({
      orgId: 'dummyOrg',
      queueId: 'dummyQueue',
    });
    // The startStalledCheckTimer method should be available and not throw
    expect(worker).toBeDefined();
  });

  // TODO: rework when we rework the MRT error handling
  test.skip('MRT throws for submitting a job that has already been moved to completed', async () => {
    const orgId = 'e7c89ce7729',
      queueId = '1',
      reviewerId = uuidv1(),
      reviewerEmail = 'test@test.com',
      itemId = uuidv1(),
      itemTypeId = uuidv1();

    await mrtService['queueOps']['addJob']({
      queueId,
      enqueueSourceInfo: { kind: 'REPORT' },
      jobPayload: {
        createdAt: new Date(),
        payload: {
          kind: 'DEFAULT',
          reportHistory: [],
          item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
            submissionId: makeSubmissionId(),
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            data: {} as NormalizedItemData,
            itemTypeIdentifier: {
              id: itemTypeId,
              version: new Date().toISOString(),
              schemaVariant: 'original',
            },
            creator: {
              id: uuidv1(),
              typeId: uuidv1(),
            },
            itemId,
          }),
          reportedForReason: undefined,
          reportedForReasons: [],
          enqueueSourceInfo: { kind: 'REPORT' },
        },
        policyIds: [],
      },
      orgId,
    });

    const dequeuedJob = await mrtService.dequeueNextJob({
      orgId,
      queueId,
      userId: reviewerId,
    });

    if (!dequeuedJob) {
      throw new Error('should have dequeued successfully.');
    }

    await mrtService.submitDecision({
      queueId,
      reportHistory: [],
      jobId: dequeuedJob.job.id,
      lockToken: dequeuedJob.lockToken,
      decisionComponents: [
        {
          type: 'CUSTOM_ACTION',
          actions: [{ id: '8481310e8c4' }],
          policies: [],
          itemIds: [itemId],
          itemTypeId,
        },
      ],
      relatedActions: [],
      reviewerId,
      reviewerEmail,
      orgId,
    });

    const duplicativeDecision = async () => {
      return mrtService.submitDecision({
        queueId,
        reportHistory: [],
        jobId: dequeuedJob.job.id,
        lockToken: dequeuedJob.lockToken,
        decisionComponents: [
          {
            type: 'CUSTOM_ACTION',
            actions: [{ id: '8481310e8c4' }],
            policies: [],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
      });
    };

    await expect(duplicativeDecision()).rejects.toThrow(
      `No job with ID ${dequeuedJob.job.id} in queue with ID ${queueId}`,
    );
  });

  describe('duplicate decision handling', () => {
    function makeDummyJob() {
      return {
        createdAt: new Date(),
        policyIds: [] as string[],
        payload: {
          kind: 'DEFAULT',
          reportHistory: [] as ReportHistory,
          item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
            submissionId: makeSubmissionId(),
            submissionTime: new Date(),
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            data: {} as NormalizedItemData,
            itemTypeIdentifier: {
              id: uuidv1(),
              version: new Date().toISOString(),
              schemaVariant: 'original',
            },
            creator: {
              id: uuidv1(),
              typeId: uuidv1(),
            },
            itemId: uuidv1(),
          }),
          enqueueSourceInfo: { kind: 'REPORT' },
        },
      } as const;
    }

    it('should reject duplicate decisions with the same lock token', async () => {
      const orgId = 'e7c89ce7729',
        queueId = '1',
        reviewerId = uuidv1(),
        reviewerEmail = 'test@test.com',
        jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId,
        itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

      await mrtService['queueOps']['addJob']({
        jobPayload,
        orgId,
        queueId,
        enqueueSourceInfo: { kind: 'REPORT' },
      });

      const dequeuedJob = await mrtService.dequeueNextJob({
        orgId,
        queueId,
        userId: reviewerId,
      });

      if (!dequeuedJob) {
        throw new Error("should've returned a job");
      }

      await mrtService.submitDecision({
        queueId,
        reportHistory: [],
        jobId: dequeuedJob.job.id,
        lockToken: dequeuedJob.lockToken,
        decisionComponents: [
          {
            type: 'CUSTOM_ACTION',
            actions: [{ id: '8481310e8c4' }],
            policies: [],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
      });

      const duplicativeDecision = async () => {
        await mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: '8481310e8c4' }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId,
        });
      };

      await expect(duplicativeDecision()).rejects.toThrow();
    });

    it.skip('should reject duplicate decisions on jobs dequeued again after the lock expires', async () => {});
  });
});
