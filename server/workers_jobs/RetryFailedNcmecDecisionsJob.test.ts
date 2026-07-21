import { v1 as uuidv1 } from 'uuid';

import {
  makeSubmissionId,
  type NormalizedItemData,
} from '../services/itemProcessingService/index.js';
import { type ItemSubmissionWithTypeIdentifier } from '../services/itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import {
  type ManualReviewToolService,
  type NcmecContentItemSubmission,
  type ReportHistory,
} from '../services/manualReviewToolService/manualReviewToolService.js';
import { instantiateOpaqueType } from '../utils/typescript-types.js';
import makeRetryFailedNcmecDecisionsJob from './RetryFailedNcmecDecisionsJob.js';

/**
 * Minimal shape of a row returned by
 * `ManualReviewToolService.getNcmecDecisions`. Only the fields read by
 * `processDecisionRetry` are populated; everything else is omitted and the
 * cast satisfies TypeScript at the injection boundary.
 */
type NcmecDecisionRow = Awaited<
  ReturnType<ManualReviewToolService['getNcmecDecisions']>
>[number];

function makeNcmecDecisionRow(orgId: string): NcmecDecisionRow {
  const userItemTypeId = uuidv1();
  const itemId = uuidv1();
  return {
    org_id: orgId,
    id: uuidv1(),
    queue_id: uuidv1(),
    reviewer_id: 'reviewer-1',
    decision_components: [
      {
        type: 'SUBMIT_NCMEC_REPORT',
        reportedMedia: [],
        reportedMessages: [],
        incidentType:
          'Child Pornography (possession, manufacture, and distribution)',
      },
    ],
    job_payload: {
      createdAt: new Date(),
      policyIds: [],
      payload: {
        kind: 'NCMEC',
        reportHistory: [] as ReportHistory,
        allMediaItems: [] as NcmecContentItemSubmission[],
        item: instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
          submissionId: makeSubmissionId(),
          submissionTime: new Date(),
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          data: {} as NormalizedItemData,
          itemTypeIdentifier: {
            id: userItemTypeId,
            version: new Date().toISOString(),
            schemaVariant: 'original',
          },
          creator: {
            id: itemId,
            typeId: userItemTypeId,
          },
          itemId,
        }),
        enqueueSourceInfo: { kind: 'REPORT' },
      },
    },
  } as NcmecDecisionRow;
}

/** The USER item type returned by `getItemTypeEventuallyConsistent`. Only the
 * fields read by the retry job / buildSubmitReportParamsFromDecision are set. */
function makeUserItemType(id: string) {
  return {
    id,
    kind: 'USER' as const,
    name: 'Test User Type',
    description: null,
    version: new Date().toISOString(),
    schemaVariant: 'original' as const,
    orgId: 'org-1',
    isDefaultUserType: false,
    schema: [
      {
        name: 'displayName',
        type: 'TEXT',
        optional: true,
      },
    ],
    schemaFieldRoles: {},
  };
}

/** Builds the 7 dependencies injected into the retry job. Each test overrides
 * only what it needs via `overrides`. Methods that should never be called in a
 * given test throw, so unexpected calls surface as failures. */
function makeDeps(
  overrides: Partial<{
    submitReport: jest.Mock;
    publishActions: jest.Mock;
    getNCMECActionsToRunAndPolicies: jest.Mock;
    decisions: NcmecDecisionRow[];
  }> = {},
) {
  const ncmecService = {
    submitReport: overrides.submitReport ?? jest.fn(async () => 'SUCCESS'),
    getUsersWithNcmecDecision: jest.fn(async () => []),
    getNcmecErrorsForJobIds: jest.fn(async () => []),
    insertOrUpdateNcmecReportError: jest.fn(async () => undefined),
    getNCMECActionsToRunAndPolicies:
      overrides.getNCMECActionsToRunAndPolicies ??
      jest.fn(async () => undefined),
  };
  const manualReviewToolService = {
    getNcmecDecisions: jest.fn(async () => overrides.decisions ?? []),
  };
  const getItemTypeEventuallyConsistent = jest.fn(async () =>
    makeUserItemType('user-type-1'),
  );
  const actionPublisher = {
    publishActions: overrides.publishActions ?? jest.fn(async () => []),
  };
  const moderationConfigService = {
    getActions: jest.fn(async () => []),
    getPolicies: jest.fn(async () => []),
  };
  const userManagementService = {
    getUsersForOrg: jest.fn(async () => []),
  };
  return {
    ncmecService,
    manualReviewToolService,
    getItemTypeEventuallyConsistent,
    actionPublisher,
    moderationConfigService,
    userManagementService,
  };
}

describe('RetryFailedNcmecDecisionsJob', () => {
  const ORG_ID = 'org-1';

  /** Snapshot of NCMEC_ENV across the suite so each test can mutate it
   * freely and we restore the original value in afterEach. */
  let originalNcmecEnv: string | undefined;

  beforeEach(() => {
    originalNcmecEnv = process.env.NCMEC_ENV;
  });
  afterEach(() => {
    if (originalNcmecEnv === undefined) {
      delete process.env.NCMEC_ENV;
    } else {
      process.env.NCMEC_ENV = originalNcmecEnv;
    }
  });

  it('passes isTest=true to submitReport when NCMEC_ENV is unset', async () => {
    delete process.env.NCMEC_ENV;
    const deps = makeDeps({
      decisions: [makeNcmecDecisionRow(ORG_ID)],
    });
    const job = makeRetryFailedNcmecDecisionsJob(
      jest.fn() as never, // closeSharedResourcesForShutdown (unused by run)
      deps.manualReviewToolService as never,
      deps.ncmecService as never,
      deps.getItemTypeEventuallyConsistent as never,
      deps.actionPublisher as never,
      deps.moderationConfigService as never,
      deps.userManagementService as never,
    );

    await job.run();

    expect(deps.ncmecService.submitReport).toHaveBeenCalledTimes(1);
    const [, isTest] = deps.ncmecService.submitReport.mock.calls[0];
    expect(isTest).toBe(true);
  });

  it('passes isTest=true to submitReport when NCMEC_ENV is "test"', async () => {
    process.env.NCMEC_ENV = 'test';
    const deps = makeDeps({
      decisions: [makeNcmecDecisionRow(ORG_ID)],
    });
    const job = makeRetryFailedNcmecDecisionsJob(
      jest.fn() as never,
      deps.manualReviewToolService as never,
      deps.ncmecService as never,
      deps.getItemTypeEventuallyConsistent as never,
      deps.actionPublisher as never,
      deps.moderationConfigService as never,
      deps.userManagementService as never,
    );

    await job.run();

    expect(deps.ncmecService.submitReport).toHaveBeenCalledTimes(1);
    const [, isTest] = deps.ncmecService.submitReport.mock.calls[0];
    expect(isTest).toBe(true);
  });

  it('passes isTest=false to submitReport when NCMEC_ENV=production', async () => {
    process.env.NCMEC_ENV = 'production';
    const deps = makeDeps({
      decisions: [makeNcmecDecisionRow(ORG_ID)],
    });
    const job = makeRetryFailedNcmecDecisionsJob(
      jest.fn() as never,
      deps.manualReviewToolService as never,
      deps.ncmecService as never,
      deps.getItemTypeEventuallyConsistent as never,
      deps.actionPublisher as never,
      deps.moderationConfigService as never,
      deps.userManagementService as never,
    );

    await job.run();

    expect(deps.ncmecService.submitReport).toHaveBeenCalledTimes(1);
    const [, isTest] = deps.ncmecService.submitReport.mock.calls[0];
    expect(isTest).toBe(false);
  });

  it('does not publish actions when NCMEC_ENV is unset (isTest=true)', async () => {
    delete process.env.NCMEC_ENV;
    const deps = makeDeps({
      decisions: [makeNcmecDecisionRow(ORG_ID)],
      // Simulate an org that has actions configured to run on NCMEC report
      // creation. In production mode these would publish; in test mode they
      // must be suppressed.
      getNCMECActionsToRunAndPolicies: jest.fn(async () => ({
        actionsToRunIds: ['action-1'],
        policyIds: ['policy-1'],
      })),
    });
    const job = makeRetryFailedNcmecDecisionsJob(
      jest.fn() as never,
      deps.manualReviewToolService as never,
      deps.ncmecService as never,
      deps.getItemTypeEventuallyConsistent as never,
      deps.actionPublisher as never,
      deps.moderationConfigService as never,
      deps.userManagementService as never,
    );

    await job.run();

    expect(deps.ncmecService.submitReport).toHaveBeenCalledTimes(1);
    expect(deps.actionPublisher.publishActions).not.toHaveBeenCalled();
  });

  it('publishes actions when NCMEC_ENV=production (isTest=false)', async () => {
    process.env.NCMEC_ENV = 'production';
    const deps = makeDeps({
      decisions: [makeNcmecDecisionRow(ORG_ID)],
      getNCMECActionsToRunAndPolicies: jest.fn(async () => ({
        actionsToRunIds: ['action-1'],
        policyIds: ['policy-1'],
      })),
    });
    const job = makeRetryFailedNcmecDecisionsJob(
      jest.fn() as never,
      deps.manualReviewToolService as never,
      deps.ncmecService as never,
      deps.getItemTypeEventuallyConsistent as never,
      deps.actionPublisher as never,
      deps.moderationConfigService as never,
      deps.userManagementService as never,
    );

    await job.run();

    expect(deps.ncmecService.submitReport).toHaveBeenCalledTimes(1);
    expect(deps.actionPublisher.publishActions).toHaveBeenCalledTimes(1);
  });
});
