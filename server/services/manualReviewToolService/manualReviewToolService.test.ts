/* eslint-disable max-lines */
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
  type NcmecContentItemSubmission,
  type ReportHistory,
} from './manualReviewToolService.js';
import { AUTOMATED_DECISION_REVIEWER_ID } from './modules/JobDecisioning.js';
import { jobIdToGuid } from './modules/QueueOperations.js';

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

function makeDummyNcmecJob() {
  return {
    createdAt: new Date(),
    policyIds: [] as string[],
    payload: {
      kind: 'NCMEC' as const,
      reportHistory: [] as ReportHistory,
      allMediaItems: [] as NcmecContentItemSubmission[],
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
      enqueueSourceInfo: { kind: 'REPORT' as const },
    },
  };
}

describe('Manual Review Tool Service', () => {
  let mrtService: ManualReviewToolService;
  let container: Dependencies;

  beforeAll(async () => {
    // The mutation should be ok here since this is initial setup in a
    // beforeAll; it doesn't involve reset state for each test in the suite

    ({ container } = await getBottle());
    mrtService = container.ManualReviewToolService;
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

  // Regression: AUTOMATIC_CLOSE decisions have no human reviewer, but
  // `manual_review_decisions.reviewer_id` is NOT NULL. Passing undefined
  // through used to insert a null and fail with 23502, which left the job
  // stuck in a retry loop. The decision must record the empty-string
  // reviewer id (rendered as "Automatic" client-side) and not throw.
  describe('automatic close decisions', () => {
    it('records an AUTOMATIC_CLOSE decision with no human reviewer', async () => {
      const orgId = 'e7c89ce7729';
      const queueId = '1';
      const jobPayload = makeDummyJob();

      await mrtService['queueOps']['addJob']({
        jobPayload,
        orgId,
        queueId,
        enqueueSourceInfo: { kind: 'REPORT' },
      });

      const dequeuedJob = await mrtService.dequeueNextJob({
        orgId,
        queueId,
        userId: uuidv1(),
      });

      if (!dequeuedJob) {
        throw new Error("should've returned a job");
      }

      // Used to throw 23502 (null reviewer_id) before the sentinel fix.
      await mrtService.submitDecision({
        queueId,
        reportHistory: [],
        jobId: dequeuedJob.job.id,
        lockToken: dequeuedJob.lockToken,
        relatedActions: [],
        orgId,
        automaticCloseDecision: {
          type: 'AUTOMATIC_CLOSE',
          reason: 'ITEM_DELETED_BEFORE_REVIEW',
        },
      });

      const row = await mrtService['pgQuery']
        .selectFrom('manual_review_tool.manual_review_decisions')
        .where('id', '=', jobIdToGuid(dequeuedJob.job.id))
        .where('org_id', '=', orgId)
        .select(['reviewer_id'])
        .executeTakeFirst();

      expect(row?.reviewer_id).toBe(AUTOMATED_DECISION_REVIEWER_ID);
    });
  });

  // Issue #616: when an org sets `mrt_requires_decision_reason_on_action`,
  // submitDecision must reject decisions whose reason is empty. The UI already
  // blocks this; the server-side check closes the API-bypass gap. Parallels the
  // requires_policy_for_decisions enforcement from #533.
  //
  // Issue #757: the requirement is split into two flags — one for violating
  // (non-ignore) decisions (`..._on_action`) and one for ignores
  // (`..._on_ignore`) — so the cases below also cover that an IGNORE decision is
  // gated by the ignore flag, not the action flag.
  describe('requires_decision_reason enforcement', () => {
    const orgId = 'e7c89ce7729';
    const queueId = '1';
    // Pulled from the staging seed data — any CUSTOM_ACTION row on this org
    // will do; the action-id validation runs before our reason check.
    const seededActionId = '1873b2f15cc';

    const setRequiresDecisionReason = async (value: boolean) => {
      await mrtService.upsertDefaultSettings({ orgId });
      await mrtService['pgQuery']
        .updateTable('manual_review_tool.manual_review_tool_settings')
        .set({ mrt_requires_decision_reason_on_action: value })
        .where('org_id', '=', orgId)
        .execute();
    };

    const setRequiresDecisionReasonOnIgnore = async (value: boolean) => {
      await mrtService.upsertDefaultSettings({ orgId });
      await mrtService['pgQuery']
        .updateTable('manual_review_tool.manual_review_tool_settings')
        .set({ mrt_requires_decision_reason_on_ignore: value })
        .where('org_id', '=', orgId)
        .execute();
    };

    beforeAll(async () => {
      // The queue row must exist before addJob, but no other test in this
      // file owns its lifecycle, so we seed it here idempotently.
      await mrtService['pgQuery']
        .insertInto('manual_review_tool.manual_review_queues')
        .values({
          id: queueId,
          name: 'integ-test-queue',
          description: null,
          org_id: orgId,
          is_default_queue: false,
          is_appeals_queue: false,
          auto_close_jobs: false,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    });

    afterEach(async () => {
      // Reset so the flags don't leak into other tests in this file or
      // subsequent runs that reuse the seeded org.
      await setRequiresDecisionReason(false);
      await setRequiresDecisionReasonOnIgnore(false);
    });

    it('rejects a decision with no reason when the flag is on', async () => {
      await setRequiresDecisionReason(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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

      await expect(
        mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: seededActionId }],
              policies: [{ id: uuidv1() }],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId,
          // decisionReason intentionally omitted
        }),
      ).rejects.toThrow(/requires every decision to include a reason/i);
    });

    it('allows a decision with a reason when the flag is on', async () => {
      await setRequiresDecisionReason(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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
            actions: [{ id: seededActionId }],
            policies: [{ id: uuidv1() }],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
        decisionReason: 'Repeat offender',
      });
    });

    it('allows a decision with no reason when the flag is off', async () => {
      // Control case: default-off behavior must remain unchanged so orgs that
      // never opt in see no difference from this PR.
      await setRequiresDecisionReason(false);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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
            actions: [{ id: seededActionId }],
            policies: [{ id: uuidv1() }],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
      });
    });

    // Issue #757: an IGNORE decision is gated by the ignore flag, not the
    // action flag. With only the ignore flag on, an IGNORE with no reason is
    // rejected.
    it('rejects an IGNORE decision with no reason when only the ignore flag is on', async () => {
      await setRequiresDecisionReason(false);
      await setRequiresDecisionReasonOnIgnore(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();

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

      await expect(
        mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [{ type: 'IGNORE' }],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId,
          // decisionReason intentionally omitted
        }),
      ).rejects.toThrow(/requires every decision to include a reason/i);
    });

    // Issue #757: with only the action flag on, ignoring a job must NOT require
    // a reason — this is the bug from the issue.
    it('allows an IGNORE decision with no reason when only the action flag is on', async () => {
      await setRequiresDecisionReason(true);
      await setRequiresDecisionReasonOnIgnore(false);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();

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
        decisionComponents: [{ type: 'IGNORE' }],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
        // decisionReason intentionally omitted
      });
    });

    // Issue #757: with only the ignore flag on, acting on a violating job must
    // NOT require a reason.
    it('allows a CUSTOM_ACTION decision with no reason when only the ignore flag is on', async () => {
      await setRequiresDecisionReason(false);
      await setRequiresDecisionReasonOnIgnore(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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
            actions: [{ id: seededActionId }],
            policies: [{ id: uuidv1() }],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
        // decisionReason intentionally omitted
      });
    });

    // Issue #736: NCMEC review uses Submit NCMEC Report or Ignore, neither of
    // which carries a written decision reason. The require-reason flag is for
    // moderation decisions on standard MRT jobs and should not block the
    // NCMEC path.
    it('allows an IGNORE decision on an NCMEC job with no reason when the flag is on', async () => {
      await setRequiresDecisionReason(true);
      await setRequiresDecisionReasonOnIgnore(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyNcmecJob();

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
        decisionComponents: [{ type: 'IGNORE' }],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
        // decisionReason intentionally omitted
      });
    });
  });

  // Issue #389: when an org sets `requires_policy_for_decisions`, submitDecision
  // must reject CUSTOM_ACTION decisions with no policies. The UI already blocks
  // this; the server-side check closes the API-bypass gap.
  describe('requires_policy_for_decisions enforcement', () => {
    const orgId = 'e7c89ce7729';
    const queueId = '1';
    // Pulled from the staging seed data — any CUSTOM_ACTION row on this org
    // will do; the action-id validation runs before our flag check.
    const seededActionId = '1873b2f15cc';

    const setRequiresPolicyForDecisions = async (value: boolean) => {
      await mrtService.upsertDefaultSettings({ orgId });
      await mrtService['pgQuery']
        .updateTable('manual_review_tool.manual_review_tool_settings')
        .set({ requires_policy_for_decisions: value })
        .where('org_id', '=', orgId)
        .execute();
    };

    beforeAll(async () => {
      await mrtService['pgQuery']
        .insertInto('manual_review_tool.manual_review_queues')
        .values({
          id: queueId,
          name: 'integ-test-queue',
          description: null,
          org_id: orgId,
          is_default_queue: false,
          is_appeals_queue: false,
          auto_close_jobs: false,
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    });

    afterEach(async () => {
      await setRequiresPolicyForDecisions(false);
    });

    it('rejects a CUSTOM_ACTION decision with no policies when the flag is on', async () => {
      await setRequiresPolicyForDecisions(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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

      await expect(
        mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: seededActionId }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId,
        }),
      ).rejects.toThrow(
        /requires every decision to include at least one policy/i,
      );
    });

    it('allows a CUSTOM_ACTION decision with policies when the flag is on', async () => {
      await setRequiresPolicyForDecisions(true);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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
            actions: [{ id: seededActionId }],
            policies: [{ id: uuidv1() }],
            itemIds: [itemId],
            itemTypeId,
          },
        ],
        relatedActions: [],
        reviewerId,
        reviewerEmail,
        orgId,
      });
    });

    it('allows a CUSTOM_ACTION decision without policies when the flag is off', async () => {
      await setRequiresPolicyForDecisions(false);

      const reviewerId = uuidv1();
      const reviewerEmail = 'test@test.com';
      const jobPayload = makeDummyJob();
      const itemId = jobPayload.payload.item.itemId;
      const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

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
            actions: [{ id: seededActionId }],
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
    });
  });

  // Issue #615: orgs created before manual_review_tool_settings existed have no
  // row, so a save against them used to UPDATE zero rows and silently no-op.
  describe('settings persistence without a pre-existing row', () => {
    const orgId = `no-row-${uuidv1()}`;

    afterEach(async () => {
      await mrtService['pgQuery']
        .deleteFrom('manual_review_tool.manual_review_tool_settings')
        .where('org_id', '=', orgId)
        .execute();
    });

    it('persists a boolean toggle when the org has no settings row', async () => {
      expect(await mrtService.getHideSkipButtonForNonAdmins(orgId)).toBe(false);

      await mrtService.updateHideSkipButtonForNonAdmins(orgId, true);

      expect(await mrtService.getHideSkipButtonForNonAdmins(orgId)).toBe(true);
    });

    it('persists the ignore callback url when the org has no settings row', async () => {
      await mrtService.updateIgnoreCallbackUrl(
        orgId,
        'https://example.com/webhook/ignore',
      );

      expect(await mrtService.getIgnoreCallbackUrl(orgId)).toBe(
        'https://example.com/webhook/ignore',
      );
    });

    it('leaves other columns at their defaults when upserting one setting', async () => {
      await mrtService.updatePreviewJobsViewEnabled(orgId, true);

      expect(await mrtService.getPreviewJobsViewEnabled(orgId)).toBe(true);
      expect(await mrtService.getRequiresPolicyForDecisions(orgId)).toBe(false);
      expect(await mrtService.getRequiresDecisionReason(orgId)).toBe(false);
    });
  });
});
