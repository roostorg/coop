/* eslint-disable max-lines */
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import createMrtQueue from '../../test/fixtureHelpers/createMrtQueue.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type MockedServer } from '../../test/setupMockedServer.js';
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

type TestDeps = MockedServer['deps'];

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

// The settings flags are stored per-org; each helper upserts the org's settings
// row (creating it if absent) and flips one flag. Tests set what they need on
// their own fresh org, and the harness rolls it all back — no leak, no reset.
async function setRequiresDecisionReasonOnAction(
  mrtService: ManualReviewToolService,
  db: TestDeps['KyselyPg'],
  orgId: string,
  value: boolean,
) {
  await mrtService.upsertDefaultSettings({ orgId });
  await db
    .updateTable('manual_review_tool.manual_review_tool_settings')
    .set({ mrt_requires_decision_reason_on_action: value })
    .where('org_id', '=', orgId)
    .execute();
}

async function setRequiresDecisionReasonOnIgnore(
  mrtService: ManualReviewToolService,
  db: TestDeps['KyselyPg'],
  orgId: string,
  value: boolean,
) {
  await mrtService.upsertDefaultSettings({ orgId });
  await db
    .updateTable('manual_review_tool.manual_review_tool_settings')
    .set({ mrt_requires_decision_reason_on_ignore: value })
    .where('org_id', '=', orgId)
    .execute();
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
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();
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
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();
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
      async ({ mrtService, deps, org, queue, actionId }) => {
        // Control case: default-off behavior must remain unchanged so orgs that
        // never opt in see no difference from this PR.
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          false,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();
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
      async ({ mrtService, deps, org, queue }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          false,
        );
        await setRequiresDecisionReasonOnIgnore(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();

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
      async ({ mrtService, deps, org, queue }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );
        await setRequiresDecisionReasonOnIgnore(
          mrtService,
          deps.KyselyPg,
          org.id,
          false,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();

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
      async ({ mrtService, deps, org, queue, actionId }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          false,
        );
        await setRequiresDecisionReasonOnIgnore(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

        const reviewerId = uuidv1();
        const reviewerEmail = 'test@test.com';
        const jobPayload = makeDummyJob();
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
      async ({ mrtService, deps, org, queue }) => {
        await setRequiresDecisionReasonOnAction(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );
        await setRequiresDecisionReasonOnIgnore(
          mrtService,
          deps.KyselyPg,
          org.id,
          true,
        );

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
        const jobPayload = makeDummyJob();
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
        const jobPayload = makeDummyJob();
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
        const jobPayload = makeDummyJob();
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
});
