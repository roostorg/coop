import { sql } from 'kysely';
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import createMrtQueue from '../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import makeDummyMrtJobPayload from '../../test/fixtureHelpers/makeDummyMrtJobPayload.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type MockedServer } from '../../test/setupMockedServer.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { UserPermission } from '../userManagementService/index.js';
import {
  type ManualReviewToolService,
  type NcmecContentItemSubmission,
  type ReportHistory,
} from './manualReviewToolService.js';
import { AUTOMATED_DECISION_REVIEWER_ID } from './modules/JobDecisioning.js';
import { jobIdToGuid } from './modules/QueueOperations.js';

type TestDeps = MockedServer['deps'];

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

async function configureDecisionReasonRequirements(
  mrtService: ManualReviewToolService,
  orgId: string,
  opts: {
    onAction?: boolean;
    onIgnore?: boolean;
  },
) {
  if (opts.onAction !== undefined) {
    await mrtService.updateRequiresDecisionReason(orgId, opts.onAction);
  }
  if (opts.onIgnore !== undefined) {
    await mrtService.updateRequiresDecisionReasonOnIgnore(orgId, opts.onIgnore);
  }
}

async function setRequiresPolicyForDecisions(
  mrtService: ManualReviewToolService,
  db: TestDeps['KyselyPg'],
  orgId: string,
  value: boolean,
) {
  await mrtService.upsertDefaultSettings({ orgId });
  await db
    .updateTable('manual_review_tool.manual_review_tool_settings')
    .set({ requires_policy_for_decisions: value })
    .where('org_id', '=', orgId)
    .execute();
}

describe('Manual Review Tool Service', () => {
  // Just the service — for cases that don't need any org-scoped fixtures.
  const testWithService = makeTransactionalTestWithFixture(
    async ({ deps }) => ({
      mrtService: deps.ManualReviewToolService,
    }),
  );

  // A fresh org with a queue and a CUSTOM_ACTION, so decision tests can enqueue
  // a job and submit a real (validatable) action without relying on seed data.
  const testWithQueue = makeTransactionalTestWithFixture(async ({ deps }) => {
    const mrtService = deps.ManualReviewToolService;
    const { org } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    const { user } = await createUser(deps.KyselyPg, org.id);
    const { queue } = await createMrtQueue({
      orgId: org.id,
      mrtService,
      userId: user.id,
    });
    const action = await deps.ModerationConfigService.createAction(org.id, {
      name: `mrt-test-action-${uid()}`,
      description: null,
      type: 'CUSTOM_ACTION',
      callbackUrl: 'https://example.com',
      callbackUrlHeaders: null,
      callbackUrlBody: null,
    });

    return { mrtService, org, user, queue, actionId: action.id };
  });

  // Test that we can start the stalled jobs checker for manual job processing
  testWithService(
    'should be able to start stalled jobs checker',
    async ({ mrtService }) => {
      const worker = await mrtService['queueOps']['getBullWorker']({
        orgId: 'dummyOrg',
        queueId: 'dummyQueue',
      });
      // The startStalledCheckTimer method should be available and not throw
      expect(worker).toBeDefined();
    },
  );

  // TODO: rework when we rework the MRT error handling
  testWithService.skip(
    'MRT throws for submitting a job that has already been moved to completed',
    async ({ mrtService }) => {
      const orgId = uid(),
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
    },
  );

  describe('duplicate decision handling', () => {
    testWithQueue(
      'should reject duplicate decisions with the same lock token',
      async ({ mrtService, org, queue, actionId }) => {
        const orgId = org.id,
          queueId = queue.id,
          reviewerId = uuidv1(),
          reviewerEmail = 'test@test.com',
          jobPayload = makeDummyMrtJobPayload();
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
              actions: [{ id: actionId }],
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
                actions: [{ id: actionId }],
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
      },
    );

    it.skip('should reject duplicate decisions on jobs dequeued again after the lock expires', async () => {});
  });

  // Regression: AUTOMATIC_CLOSE decisions have no human reviewer, but
  // `manual_review_decisions.reviewer_id` is NOT NULL. Passing undefined
  // through used to insert a null and fail with 23502, which left the job
  // stuck in a retry loop. The decision must record the empty-string
  // reviewer id (rendered as "Automatic" client-side) and not throw.
  describe('automatic close decisions', () => {
    testWithQueue(
      'records an AUTOMATIC_CLOSE decision with no human reviewer',
      async ({ mrtService, org, queue }) => {
        const orgId = org.id,
          queueId = queue.id,
          jobPayload = makeDummyMrtJobPayload();

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
          .select(['reviewer_id', 'assigned_at'])
          .executeTakeFirst();

        expect(row?.reviewer_id).toBe(AUTOMATED_DECISION_REVIEWER_ID);
        expect(row?.assigned_at).toBeNull();
      },
    );
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
    testWithQueue(
      'rejects a decision with no reason when the flag is on',
      async ({ mrtService, org, queue, actionId }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: true,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await expect(
          mrtService.submitDecision({
            queueId: queue.id,
            reportHistory: [],
            jobId: dequeuedJob.job.id,
            lockToken: dequeuedJob.lockToken,
            decisionComponents: [
              {
                type: 'CUSTOM_ACTION',
                actions: [{ id: actionId }],
                policies: [{ id: uuidv1() }],
                itemIds: [itemId],
                itemTypeId,
              },
            ],
            relatedActions: [],
            reviewerId,
            reviewerEmail,
            orgId: org.id,
            // decisionReason intentionally omitted
          }),
        ).rejects.toThrow(/requires every decision to include a reason/i);
      },
    );

    testWithQueue(
      'allows a decision with a reason when the flag is on',
      async ({ mrtService, org, queue, actionId }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: true,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [{ id: uuidv1() }],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
          decisionReason: 'Repeat offender',
        });
      },
    );

    testWithQueue(
      'allows a decision with no reason when the flag is off',
      async ({ mrtService, org, queue, actionId }) => {
        // Control case: default-off behavior must remain unchanged so orgs that
        // never opt in see no difference from this PR.
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: false,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [{ id: uuidv1() }],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
        });
      },
    );

    // Issue #757: an IGNORE decision is gated by the ignore flag, not the
    // action flag. With only the ignore flag on, an IGNORE with no reason is
    // rejected.
    testWithQueue(
      'rejects an IGNORE decision with no reason when only the ignore flag is on',
      async ({ mrtService, org, queue }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: false,
          onIgnore: true,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await expect(
          mrtService.submitDecision({
            queueId: queue.id,
            reportHistory: [],
            jobId: dequeuedJob.job.id,
            lockToken: dequeuedJob.lockToken,
            decisionComponents: [{ type: 'IGNORE' }],
            relatedActions: [],
            reviewerId,
            reviewerEmail,
            orgId: org.id,
            // decisionReason intentionally omitted
          }),
        ).rejects.toThrow(/requires every decision to include a reason/i);
      },
    );

    // Issue #757: with only the action flag on, ignoring a job must NOT require
    // a reason — this is the bug from the issue.
    testWithQueue(
      'allows an IGNORE decision with no reason when only the action flag is on',
      async ({ mrtService, org, queue }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: true,
          onIgnore: false,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [{ type: 'IGNORE' }],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
          // decisionReason intentionally omitted
        });
      },
    );

    // Issue #757: with only the ignore flag on, acting on a violating job must
    // NOT require a reason.
    testWithQueue(
      'allows a CUSTOM_ACTION decision with no reason when only the ignore flag is on',
      async ({ mrtService, org, queue, actionId }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: false,
          onIgnore: true,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [{ id: uuidv1() }],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
          // decisionReason intentionally omitted
        });
      },
    );

    // Issue #736: NCMEC review uses Submit NCMEC Report or Ignore, neither of
    // which carries a written decision reason. The require-reason flag is for
    // moderation decisions on standard MRT jobs and should not block the
    // NCMEC path.
    testWithQueue(
      'allows an IGNORE decision on an NCMEC job with no reason when the flag is on',
      async ({ mrtService, org, queue }) => {
        await configureDecisionReasonRequirements(mrtService, org.id, {
          onAction: true,
          onIgnore: true,
        });

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyNcmecJob();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [{ type: 'IGNORE' }],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
          // decisionReason intentionally omitted
        });
      },
    );
  });

  // Issue #389: when an org sets `requires_policy_for_decisions`, submitDecision
  // must reject CUSTOM_ACTION decisions with no policies. The UI already blocks
  // this; the server-side check closes the API-bypass gap.
  describe('requires_policy_for_decisions enforcement', () => {
    testWithQueue(
      'rejects a CUSTOM_ACTION decision with no policies when the flag is on',
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresPolicyForDecisions(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await expect(
          mrtService.submitDecision({
            queueId: queue.id,
            reportHistory: [],
            jobId: dequeuedJob.job.id,
            lockToken: dequeuedJob.lockToken,
            decisionComponents: [
              {
                type: 'CUSTOM_ACTION',
                actions: [{ id: actionId }],
                policies: [],
                itemIds: [itemId],
                itemTypeId,
              },
            ],
            relatedActions: [],
            reviewerId,
            reviewerEmail,
            orgId: org.id,
          }),
        ).rejects.toThrow(
          /requires every decision to include at least one policy/i,
        );
      },
    );

    testWithQueue(
      'allows a CUSTOM_ACTION decision with policies when the flag is on',
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresPolicyForDecisions(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [{ id: uuidv1() }],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
        });
      },
    );

    testWithQueue(
      'allows a CUSTOM_ACTION decision without policies when the flag is off',
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresPolicyForDecisions(
          mrtService,
          deps.KyselyPg,
          org.id,
          false,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId: org.id,
          queueId: queue.id,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId: org.id,
          queueId: queue.id,
          userId: reviewerId,
        });

        if (!dequeuedJob) {
          throw new Error("should've returned a job");
        }

        await mrtService.submitDecision({
          queueId: queue.id,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId,
          reviewerEmail,
          orgId: org.id,
        });
      },
    );
  });

  // Issue #615: orgs created before manual_review_tool_settings existed have no
  // row, so a save against them used to UPDATE zero rows and silently no-op.
  describe('settings persistence without a pre-existing row', () => {
    testWithService(
      'persists a boolean toggle when the org has no settings row',
      async ({ mrtService }) => {
        const orgId = `no-row-${uid()}`;
        expect(await mrtService.getHideSkipButtonForNonAdmins(orgId)).toBe(
          false,
        );

        await mrtService.updateHideSkipButtonForNonAdmins(orgId, true);

        expect(await mrtService.getHideSkipButtonForNonAdmins(orgId)).toBe(
          true,
        );
      },
    );

    testWithService(
      'persists the ignore callback url when the org has no settings row',
      async ({ mrtService }) => {
        const orgId = `no-row-${uid()}`;
        await mrtService.updateIgnoreCallbackUrl(
          orgId,
          'https://example.com/webhook/ignore',
        );

        expect(await mrtService.getIgnoreCallbackUrl(orgId)).toBe(
          'https://example.com/webhook/ignore',
        );
      },
    );

    testWithService(
      'leaves other columns at their defaults when upserting one setting',
      async ({ mrtService }) => {
        const orgId = `no-row-${uid()}`;
        await mrtService.updatePreviewJobsViewEnabled(orgId, true);

        expect(await mrtService.getPreviewJobsViewEnabled(orgId)).toBe(true);
        expect(await mrtService.getRequiresPolicyForDecisions(orgId)).toBe(
          false,
        );
        expect(await mrtService.getRequiresDecisionReason(orgId)).toBe(false);
      },
    );
  });

  describe('job claims and assigned_at', () => {
    testWithQueue(
      'records a claim on dequeue and copies latest claim onto the decision',
      async ({ mrtService, org, queue, actionId, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const reviewerId = uuidv1();
        const reviewerEmail = 'claim-test@example.com';
        const jobPayload = makeDummyMrtJobPayload();
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
          throw new Error('expected a dequeued job');
        }

        const claims = await deps.KyselyPg.selectFrom(
          'manual_review_tool.job_claims',
        )
          .selectAll()
          .where('org_id', '=', orgId)
          .where('job_id', '=', dequeuedJob.job.id)
          .execute();
        expect(claims).toHaveLength(1);
        expect(claims[0].user_id).toBe(reviewerId);

        await mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: dequeuedJob.job.id,
          lockToken: dequeuedJob.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
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

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at', 'created_at', 'reviewer_id'])
          .where('org_id', '=', orgId)
          .where(
            sql<string>`(job_payload->>'id')::text`,
            '=',
            dequeuedJob.job.id,
          )
          .executeTakeFirstOrThrow();

        expect(decision.reviewer_id).toBe(reviewerId);
        expect(decision.assigned_at).toEqual(claims[0].claimed_at);
        if (decision.assigned_at == null) {
          throw new Error('expected assigned_at');
        }
        expect(decision.created_at.getTime()).toBeGreaterThanOrEqual(
          decision.assigned_at.getTime(),
        );

        const handleTime = await mrtService.getHandleTime({
          orgId,
          groupBy: ['reviewer_id'],
          filterBy: {
            startDate: new Date(Date.now() - 60_000),
            endDate: new Date(Date.now() + 60_000),
            queueIds: [],
            reviewerIds: [reviewerId],
          },
        });
        expect(handleTime).toHaveLength(1);
        expect(handleTime[0].reviewer_id).toBe(reviewerId);
        const handleTimeSeconds = handleTime[0].handle_time;
        if (handleTimeSeconds == null) {
          throw new Error('expected handle_time');
        }
        expect(handleTimeSeconds).toBeGreaterThanOrEqual(0);

        const recent = await mrtService.getRecentDecisions({
          orgId,
          userPermissions: [UserPermission.VIEW_MRT],
          input: { page: 0 },
        });
        const recentDecision = recent.find(
          (it) => it.jobId === dequeuedJob.job.id,
        );
        expect(recentDecision).toBeDefined();
        expect(recentDecision?.assignedAt).toEqual(claims[0].claimed_at);
        expect(recentDecision?.jobCreatedAt?.getTime()).toBe(
          new Date(dequeuedJob.job.createdAt).getTime(),
        );
      },
    );

    testWithQueue(
      'uses the latest claim after a job is released and reclaimed',
      async ({ mrtService, org, queue, actionId, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const firstReviewerId = uuidv1();
        const secondReviewerId = uuidv1();
        const reviewerEmail = 'reclaim-test@example.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const firstClaim = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: firstReviewerId,
        });
        if (!firstClaim) {
          throw new Error('expected first claim');
        }

        await mrtService.releaseJobLock({
          orgId,
          queueId,
          jobId: firstClaim.job.id,
          lockToken: firstClaim.lockToken,
        });

        const secondClaim = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: secondReviewerId,
        });
        if (!secondClaim) {
          throw new Error('expected second claim');
        }
        expect(secondClaim.job.id).toBe(firstClaim.job.id);

        const claims = await deps.KyselyPg.selectFrom(
          'manual_review_tool.job_claims',
        )
          .selectAll()
          .where('org_id', '=', orgId)
          .where('job_id', '=', firstClaim.job.id)
          .orderBy('claimed_at', 'asc')
          .execute();
        expect(claims).toHaveLength(2);
        expect(claims[0].user_id).toBe(firstReviewerId);
        expect(claims[1].user_id).toBe(secondReviewerId);

        await mrtService.submitDecision({
          queueId,
          reportHistory: [],
          jobId: secondClaim.job.id,
          lockToken: secondClaim.lockToken,
          decisionComponents: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          relatedActions: [],
          reviewerId: secondReviewerId,
          reviewerEmail,
          orgId,
        });

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at'])
          .where('org_id', '=', orgId)
          .where(
            sql<string>`(job_payload->>'id')::text`,
            '=',
            secondClaim.job.id,
          )
          .executeTakeFirstOrThrow();

        expect(decision.assigned_at).toEqual(claims[1].claimed_at);
      },
    );

    testWithQueue(
      'leaves assigned_at null on AUTOMATIC_CLOSE even after a human claim',
      async ({ mrtService, org, queue, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const claimerId = uuidv1();
        const jobPayload = makeDummyMrtJobPayload();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const dequeuedJob = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: claimerId,
        });
        if (!dequeuedJob) {
          throw new Error('expected a dequeued job');
        }

        const claims = await deps.KyselyPg.selectFrom(
          'manual_review_tool.job_claims',
        )
          .selectAll()
          .where('org_id', '=', orgId)
          .where('job_id', '=', dequeuedJob.job.id)
          .execute();
        expect(claims).toHaveLength(1);

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

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at', 'reviewer_id'])
          .where('org_id', '=', orgId)
          .where(
            sql<string>`(job_payload->>'id')::text`,
            '=',
            dequeuedJob.job.id,
          )
          .executeTakeFirstOrThrow();

        expect(decision.reviewer_id).toBe(AUTOMATED_DECISION_REVIEWER_ID);
        expect(decision.assigned_at).toBeNull();

        const handleTime = await mrtService.getHandleTime({
          orgId,
          groupBy: [],
          filterBy: {
            startDate: new Date(Date.now() - 60_000),
            endDate: new Date(Date.now() + 60_000),
            queueIds: [],
            reviewerIds: [],
          },
        });
        expect(handleTime).toHaveLength(1);
        expect(handleTime[0].handle_time).toBeNull();
      },
    );

    testWithQueue(
      'leaves assigned_at null for swept AUTOMATIC_CLOSE despite a prior claim',
      async ({ mrtService, org, queue, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const claimerId = uuidv1();
        const triggerReviewerId = uuidv1();
        const reviewerEmail = 'sweep-auto-close@example.com';
        const jobPayload = makeDummyMrtJobPayload();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const claimed = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: claimerId,
        });
        if (!claimed) {
          throw new Error('expected a claimed job');
        }

        await mrtService.releaseJobLock({
          orgId,
          queueId,
          jobId: claimed.job.id,
          lockToken: claimed.lockToken,
        });

        const outcome = await mrtService[
          'jobDecisioning'
        ].recordSweptJobDisposition({
          orgId,
          queueId,
          job: claimed.job,
          disposition: 'AUTOMATIC_CLOSE',
          triggerCustomActions: [],
          reviewerId: triggerReviewerId,
          reviewerEmail,
        });
        expect(outcome).toBe('logged');

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at', 'reviewer_id'])
          .where('org_id', '=', orgId)
          .where(sql<string>`(job_payload->>'id')::text`, '=', claimed.job.id)
          .executeTakeFirstOrThrow();

        expect(decision.reviewer_id).toBe(triggerReviewerId);
        expect(decision.assigned_at).toBeNull();
      },
    );

    testWithQueue(
      'leaves assigned_at null when the deciding reviewer never claimed the job',
      async ({ mrtService, org, queue, actionId, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const claimerId = uuidv1();
        const triggerReviewerId = uuidv1();
        const reviewerEmail = 'sweep-like-test@example.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const claimed = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: claimerId,
        });
        if (!claimed) {
          throw new Error('expected a claimed job');
        }

        await mrtService.releaseJobLock({
          orgId,
          queueId,
          jobId: claimed.job.id,
          lockToken: claimed.lockToken,
        });

        const outcome = await mrtService[
          'jobDecisioning'
        ].recordSweptJobDisposition({
          orgId,
          queueId,
          job: claimed.job,
          disposition: 'SAME_ACTION',
          triggerCustomActions: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          reviewerId: triggerReviewerId,
          reviewerEmail,
        });
        expect(outcome).toBe('logged');

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at', 'reviewer_id'])
          .where('org_id', '=', orgId)
          .where(sql<string>`(job_payload->>'id')::text`, '=', claimed.job.id)
          .executeTakeFirstOrThrow();

        expect(decision.reviewer_id).toBe(triggerReviewerId);
        expect(decision.assigned_at).toBeNull();
      },
    );

    testWithQueue(
      'leaves assigned_at null on swept SAME_ACTION even if the trigger reviewer previously claimed the job',
      async ({ mrtService, org, queue, actionId, deps }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const triggerReviewerId = uuidv1();
        const reviewerEmail = 'stale-claim-sweep@example.com';
        const jobPayload = makeDummyMrtJobPayload();
        const itemId = jobPayload.payload.item.itemId;
        const itemTypeId = jobPayload.payload.item.itemTypeIdentifier.id;

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const claimed = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: triggerReviewerId,
        });
        if (!claimed) {
          throw new Error('expected a claimed job');
        }

        await mrtService.releaseJobLock({
          orgId,
          queueId,
          jobId: claimed.job.id,
          lockToken: claimed.lockToken,
        });

        const claims = await deps.KyselyPg.selectFrom(
          'manual_review_tool.job_claims',
        )
          .selectAll()
          .where('org_id', '=', orgId)
          .where('job_id', '=', claimed.job.id)
          .where('user_id', '=', triggerReviewerId)
          .execute();
        expect(claims).toHaveLength(1);

        const outcome = await mrtService[
          'jobDecisioning'
        ].recordSweptJobDisposition({
          orgId,
          queueId,
          job: claimed.job,
          disposition: 'SAME_ACTION',
          triggerCustomActions: [
            {
              type: 'CUSTOM_ACTION',
              actions: [{ id: actionId }],
              policies: [],
              itemIds: [itemId],
              itemTypeId,
            },
          ],
          reviewerId: triggerReviewerId,
          reviewerEmail,
        });
        expect(outcome).toBe('logged');

        const decision = await deps.KyselyPg.selectFrom(
          'manual_review_tool.manual_review_decisions',
        )
          .select(['assigned_at', 'reviewer_id'])
          .where('org_id', '=', orgId)
          .where(sql<string>`(job_payload->>'id')::text`, '=', claimed.job.id)
          .executeTakeFirstOrThrow();

        expect(decision.reviewer_id).toBe(triggerReviewerId);
        expect(decision.assigned_at).toBeNull();
      },
    );

    testWithQueue(
      'still dequeues when claim logging fails',
      async ({ mrtService, org, queue }) => {
        const orgId = org.id;
        const queueId = queue.id;
        const firstReviewerId = uuidv1();
        const jobPayload = makeDummyMrtJobPayload();

        await mrtService['queueOps']['addJob']({
          jobPayload,
          orgId,
          queueId,
          enqueueSourceInfo: { kind: 'REPORT' },
        });

        const releaseSpy = jest.spyOn(mrtService['queueOps'], 'releaseJobLock');
        const logClaimSpy = jest
          .spyOn(mrtService['claimOps'], 'logClaim')
          .mockRejectedValueOnce(new Error('claim insert failed'));

        const dequeued = await mrtService.dequeueNextJob({
          orgId,
          queueId,
          userId: firstReviewerId,
        });

        expect(dequeued).not.toBeNull();
        expect(dequeued?.lockToken).toBe(firstReviewerId);
        expect(releaseSpy).not.toHaveBeenCalled();

        logClaimSpy.mockRestore();
        releaseSpy.mockRestore();
      },
    );
  });
});
