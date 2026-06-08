/* eslint-disable max-lines */
import { uid } from 'uid';
import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
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
import {
  type ContentManualReviewJobPayload,
  type NcmecManualReviewJobPayload,
  type ReportHistory,
} from '../manualReviewToolService.js';
import { scrubPayloadForReporter } from './ReporterInvalidation.js';

function makeItem(): ItemSubmissionWithTypeIdentifier {
  return instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
    submissionId: makeSubmissionId(),
    submissionTime: new Date(),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    data: {} as NormalizedItemData,
    itemTypeIdentifier: {
      id: uuidv1(),
      version: new Date().toISOString(),
      schemaVariant: 'original',
    },
    creator: { id: uuidv1(), typeId: uuidv1() },
    itemId: uuidv1(),
  });
}

function makeReportHistoryEntry(reporter: {
  typeId: string;
  id: string;
}): ReportHistory[number] {
  return {
    reportId: uuidv1(),
    reportedAt: new Date(),
    reporterId: reporter,
    reason: 'spam',
  };
}

describe('scrubPayloadForReporter (pure)', () => {
  const badReporter = { typeId: 'user_type', id: 'bad_reporter_1' };
  const goodReporter = { typeId: 'user_type', id: 'good_reporter_1' };

  it('returns the payload unchanged with removedCount=0 when no entries match', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        makeReportHistoryEntry(goodReporter),
        makeReportHistoryEntry({ typeId: 'user_type', id: 'other_user' }),
      ],
      reportedForReasons: [
        { reporterId: goodReporter, reason: 'spam' },
        {
          reporterId: { typeId: 'user_type', id: 'other_user' },
          reason: 'spam',
        },
      ],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(0);
    // No-op should return the same reference to avoid unnecessary writes.
    expect(result.payload).toBe(payload);
  });

  it('filters matching entries from reportHistory AND reportedForReasons on DEFAULT payloads', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        makeReportHistoryEntry(badReporter),
        makeReportHistoryEntry(goodReporter),
        makeReportHistoryEntry(badReporter),
      ],
      reportedForReasons: [
        { reporterId: badReporter, reason: 'fake' },
        { reporterId: goodReporter, reason: 'spam' },
      ],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(2);
    expect(result.payload.reportHistory).toHaveLength(1);
    expect(result.payload.reportHistory[0]?.reporterId).toEqual(goodReporter);
    expect(
      (result.payload as ContentManualReviewJobPayload).reportedForReasons,
    ).toHaveLength(1);
    expect(
      (result.payload as ContentManualReviewJobPayload).reportedForReasons?.[0]
        ?.reporterId,
    ).toEqual(goodReporter);
  });

  it('produces an empty reportHistory when every entry matches', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        makeReportHistoryEntry(badReporter),
        makeReportHistoryEntry(badReporter),
      ],
      reportedForReasons: [{ reporterId: badReporter, reason: 'fake' }],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(2);
    expect(result.payload.reportHistory).toHaveLength(0);
    expect(
      (result.payload as ContentManualReviewJobPayload).reportedForReasons,
    ).toHaveLength(0);
  });

  it('scrubs reportedForReasons on legacy jobs whose reportHistory is empty', () => {
    // legacyJobToJob synthesizes reportedForReasons from reporterIdentifier
    // while leaving reportHistory empty, so the reporter only appears there.
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [],
      reportedForReasons: [{ reporterId: badReporter, reason: 'fake' }],
      reportedForReason: 'fake',
      reporterIdentifier: badReporter,
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(1);
    const scrubbed = result.payload as ContentManualReviewJobPayload;
    expect(scrubbed.reportedForReasons).toHaveLength(0);
    expect(scrubbed.reportHistory).toHaveLength(0);
    expect(scrubbed.reporterIdentifier).toBeUndefined();
  });

  it('repopulates reportedForReasons from the new newest history entry when scrubbing empties it', () => {
    // Regression: scrubbing the newest reporter could leave
    // `reportedForReasons` empty while `reportHistory` still had entries,
    // hiding the next-newest report from both the primary panel and the
    // "other reports" table.
    const survivor = { typeId: 'user_type', id: 'survivor' };
    const survivorEntry = makeReportHistoryEntry(survivor);
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      // newest-to-oldest, per the order produced by `#mergeJobPayloads`
      reportHistory: [makeReportHistoryEntry(badReporter), survivorEntry],
      reportedForReasons: [{ reporterId: badReporter, reason: 'fake' }],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(1);
    expect(result.payload.reportHistory).toHaveLength(1);
    expect(result.payload.reportHistory[0]?.reporterId).toEqual(survivor);

    const reasons = (result.payload as ContentManualReviewJobPayload)
      .reportedForReasons;
    expect(reasons).toHaveLength(1);
    expect(reasons?.[0]?.reporterId).toEqual(survivor);
    expect(reasons?.[0]?.reason).toBe(survivorEntry.reason);
  });

  it('repoints legacy reportedForReason/reporterIdentifier when they referenced the scrubbed reporter', () => {
    const survivor = { typeId: 'user_type', id: 'survivor' };
    const survivorEntry = makeReportHistoryEntry(survivor);
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [makeReportHistoryEntry(badReporter), survivorEntry],
      reportedForReasons: [{ reporterId: badReporter, reason: 'fake' }],
      reportedForReason: 'fake',
      reporterIdentifier: badReporter,
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    const scrubbed = result.payload as ContentManualReviewJobPayload;
    expect(scrubbed.reporterIdentifier).toEqual(survivor);
    expect(scrubbed.reportedForReason).toBe(survivorEntry.reason);
  });

  it('leaves legacy reporterIdentifier untouched when it referenced a different reporter', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        makeReportHistoryEntry(goodReporter),
        makeReportHistoryEntry(badReporter),
      ],
      reportedForReasons: [{ reporterId: goodReporter, reason: 'spam' }],
      reportedForReason: 'spam',
      reporterIdentifier: goodReporter,
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    const scrubbed = result.payload as ContentManualReviewJobPayload;
    expect(scrubbed.reporterIdentifier).toEqual(goodReporter);
    expect(scrubbed.reportedForReason).toBe('spam');
  });

  it('does not match entries where the reporterId is undefined (rule-engine / system entries)', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        {
          reportId: uuidv1(),
          reportedAt: new Date(),
          reporterId: undefined,
          reason: 'rule output',
        },
        makeReportHistoryEntry(badReporter),
      ],
      reportedForReasons: [],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(1);
    expect(result.payload.reportHistory).toHaveLength(1);
    expect(result.payload.reportHistory[0]?.reporterId).toBeUndefined();
  });

  it('matches on both typeId AND id, not either alone', () => {
    const payload: ContentManualReviewJobPayload = {
      kind: 'DEFAULT',
      item: makeItem(),
      reportHistory: [
        makeReportHistoryEntry({
          typeId: badReporter.typeId,
          id: 'different_id',
        }),
        makeReportHistoryEntry({
          typeId: 'different_type',
          id: badReporter.id,
        }),
        makeReportHistoryEntry(badReporter),
      ],
      reportedForReasons: [],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(1);
    expect(result.payload.reportHistory).toHaveLength(2);
  });

  it('only touches reportHistory (not reportedForReasons) on NCMEC payloads', () => {
    const payload: NcmecManualReviewJobPayload = {
      kind: 'NCMEC',
      item: makeItem(),
      allMediaItems: [],
      reportHistory: [
        makeReportHistoryEntry(badReporter),
        makeReportHistoryEntry(goodReporter),
      ],
    };
    const result = scrubPayloadForReporter(payload, badReporter);
    expect(result.removedCount).toBe(1);
    expect(result.payload.kind).toBe('NCMEC');
    expect(result.payload.reportHistory).toHaveLength(1);
    // NCMEC payloads have no `reportedForReasons`; make sure we didn't
    // synthesize one.
    expect(
      (
        result.payload as NcmecManualReviewJobPayload as unknown as Record<
          string,
          unknown
        >
      ).reportedForReasons,
    ).toBeUndefined();
  });
});

// Integration tests below mirror the pattern in `QueueOperations.test.ts`.

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
    const { itemTypes, cleanup: itemTypesCleanup } =
      await createContentItemTypes({
        moderationConfigService: container.ModerationConfigService,
        orgId: org.id,
        extra: {},
      });
    const { queue, cleanup: queueCleanup } = await createMrtQueue({
      orgId: org.id,
      mrtService: container.ManualReviewToolService,
      userId: user.id,
    });

    const mrtService = container.ManualReviewToolService;

    // Bracket-index into the private QueueOperations to seed jobs directly,
    // matching the pattern in manualReviewToolService.test.ts.
    const queueOps = mrtService['queueOps'];

    const addJob = async (opts: {
      itemId: string;
      reportHistory: ReportHistory;
    }) => {
      const item = instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
        submissionId: makeSubmissionId(),
        submissionTime: new Date(),
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: {} as NormalizedItemData,
        itemTypeIdentifier: {
          id: itemTypes[0].id,
          version: new Date().toISOString(),
          schemaVariant: 'original',
        },
        creator: { id: uuidv1(), typeId: uuidv1() },
        itemId: opts.itemId,
      });
      return queueOps.addJob({
        orgId: org.id,
        queueId: queue.id,
        enqueueSourceInfo: { kind: 'REPORT' },
        jobPayload: {
          createdAt: new Date(),
          policyIds: [],
          payload: {
            kind: 'DEFAULT',
            item,
            reportHistory: opts.reportHistory,
            reportedForReasons: opts.reportHistory.map((r) => ({
              reporterId: r.reporterId,
              reason: r.reason,
            })),
          },
        },
      });
    };

    return {
      org,
      user,
      queue,
      mrtService,
      addJob,
      cleanup: async () => {
        await queueCleanup();
        await itemTypesCleanup();
        await userCleanup();
        await orgCleanup();
        await container.KyselyPg.destroy();
        await container.KyselyPgReadReplica.destroy();
      },
    };
  });

describe('ManualReviewToolService.invalidateReportsFromReporter', () => {
  const invoker = (orgId: string, userId: string) => ({
    userId,
    permissions: [UserPermission.EDIT_MRT_QUEUES] as const,
    orgId,
  });

  testWithQueue()(
    'rejects with UnauthorizedError when invoker lacks EDIT_MRT_QUEUES',
    async ({ org, user, mrtService }) => {
      await expect(
        mrtService.invalidateReportsFromReporter({
          orgId: org.id,
          reporter: { typeId: 'user_type', id: 'bad' },
          invokedBy: { userId: user.id, permissions: [], orgId: org.id },
        }),
      ).rejects.toMatchObject({ name: 'UnauthorizedError', status: 403 });
    },
  );

  testWithQueue()(
    'scrubs the bad reporter from a multi-reporter job and keeps the job',
    async ({ org, user, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      const good = { typeId: 'user_type', id: 'good' };
      const itemId = uuidv1();
      await addJob({
        itemId,
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: good,
            reason: 'legit',
          },
        ],
      });

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      expect(result.jobsScrubbed).toBe(1);
      expect(result.jobsDeleted).toBe(0);
      expect(result.reportsRemoved).toBe(1);
    },
  );

  testWithQueue()(
    'deletes a job whose only report is from the bad reporter (REPORT-originated)',
    async ({ org, user, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      const itemId = uuidv1();
      await addJob({
        itemId,
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
        ],
      });

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      expect(result.jobsDeleted).toBe(1);
      expect(result.jobsScrubbed).toBe(0);
      expect(result.reportsRemoved).toBe(1);
    },
  );

  testWithQueue()(
    // A reviewer viewing a job (active, locked with their userId)
    // invalidates the only reporter; the job should be deleted.
    'deletes a locked single-report job when the invoker is the lock holder',
    async ({ org, user, queue, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
        ],
      });

      const dequeued = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });
      expect(dequeued).toBeTruthy();

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      expect(result.reportsRemoved).toBe(1);
      expect(result.jobsDeleted).toBe(1);
      expect(result.jobsScrubbed).toBe(0);
    },
  );

  testWithQueue()(
    // Safety: if a DIFFERENT reviewer holds the lock on the active job,
    // we must not steal it. The job stays in the queue and the bad
    // reporter's entry is scrubbed in place.
    "scrubs (does not delete) when another reviewer's lock would have to be stolen",
    async ({ org, user, queue, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
        ],
      });

      // A different reviewer holds the lock. The lockToken is an opaque
      // string in BullMQ, so no real second user is needed here.
      const otherReviewerId = 'some-other-reviewer-id';
      const dequeued = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: otherReviewerId,
      });
      expect(dequeued).toBeTruthy();

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      expect(result.reportsRemoved).toBe(1);
      expect(result.jobsDeleted).toBe(0);
      expect(result.jobsScrubbed).toBe(1);
    },
  );

  testWithQueue()(
    // Regression for the iterator-skip bug: previously the sweep paginated
    // by absolute index, so every removal shifted later indices down and
    // jobs were silently skipped. Snapshot-then-process must visit every
    // seeded job even with `batchSize` smaller than the queue.
    'visits every pending job even when removals happen mid-sweep',
    async ({ org, user, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      const totalJobs = 5;
      for (let i = 0; i < totalJobs; i++) {
        await addJob({
          itemId: uuidv1(),
          reportHistory: [
            {
              reportId: uuidv1(),
              reportedAt: new Date(),
              reporterId: bad,
              reason: 'fake',
            },
          ],
        });
      }

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
        // Force pagination smaller than the queue so the old index-based
        // pagination would have skipped half the jobs.
        batchSize: 2,
        maxJobsPerQueue: 100,
      });

      expect(result.reportsRemoved).toBe(totalJobs);
      expect(result.jobsDeleted).toBe(totalJobs);
      expect(result.jobsScrubbed).toBe(0);
    },
  );

  testWithQueue()(
    // Concurrency guard: a second org-wide sweep for the same (org,
    // reporter) while one is in flight must be rejected.
    'rejects a concurrent org-wide sweep for the same (org, reporter)',
    async ({ org, user, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      // Seed enough jobs that the first sweep has work to do; the second
      // call races against it.
      for (let i = 0; i < 3; i++) {
        await addJob({
          itemId: uuidv1(),
          reportHistory: [
            {
              reportId: uuidv1(),
              reportedAt: new Date(),
              reporterId: bad,
              reason: 'fake',
            },
          ],
        });
      }

      const first = mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });
      const second = mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      // The second one races but should either reject with SWEEP_IN_FLIGHT
      // or, if the first finishes too quickly, return zeros (no work).
      const [firstResult, secondOutcome] = await Promise.all([
        first,
        second.then(
          (value) => ({ kind: 'ok' as const, value }),
          (err: unknown) => ({ kind: 'err' as const, err }),
        ),
      ]);
      expect(firstResult.reportsRemoved).toBe(3);
      if (secondOutcome.kind === 'err') {
        expect((secondOutcome.err as { code?: string }).code).toBe(
          'SWEEP_IN_FLIGHT',
        );
      } else {
        expect(secondOutcome.value.reportsRemoved).toBe(0);
      }
    },
  );

  testWithQueue()(
    // Regression: iterator must include Bull's `active` state so the job
    // a reviewer is currently viewing isn't skipped.
    'scrubs a job that is currently locked by a reviewer (active state)',
    async ({ org, user, queue, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      const good = { typeId: 'user_type', id: 'good' };
      await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: good,
            reason: 'legit',
          },
        ],
      });

      // Move job into `active`, as if a reviewer opened it.
      const dequeued = await mrtService.dequeueNextJob({
        orgId: org.id,
        queueId: queue.id,
        userId: user.id,
      });
      expect(dequeued).toBeTruthy();

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
      });

      // Job is locked → can't remove, so we scrub in place.
      expect(result.reportsRemoved).toBe(1);
      expect(result.jobsDeleted).toBe(0);
      expect(result.jobsScrubbed).toBe(1);
    },
  );

  testWithQueue()(
    'scopes the sweep to a single job when jobId is provided',
    async ({ org, user, mrtService, addJob }) => {
      const bad = { typeId: 'user_type', id: 'bad' };
      const targetJob = await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
        ],
      });
      // A second job with a report from the same bad reporter that must
      // be left untouched.
      await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: bad,
            reason: 'fake',
          },
        ],
      });

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: bad,
        invokedBy: invoker(org.id, user.id),
        jobId: targetJob.id,
      });

      expect(result.queuesScanned).toBe(1);
      expect(result.jobsScanned).toBe(1);
      expect(result.reportsRemoved).toBe(1);
      // Target job was REPORT-only -> deleted; the second job survives.
      expect(result.jobsDeleted).toBe(1);
      expect(result.jobsScrubbed).toBe(0);
    },
  );

  testWithQueue()(
    'returns zeros when jobId refers to a job that no longer exists',
    async ({ org, user, mrtService }) => {
      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: { typeId: 'user_type', id: 'bad' },
        invokedBy: invoker(org.id, user.id),
        jobId: 'unknown-job-id',
      });

      expect(result.queuesScanned).toBe(0);
      expect(result.jobsScanned).toBe(0);
      expect(result.reportsRemoved).toBe(0);
      expect(result.jobsDeleted).toBe(0);
      expect(result.jobsScrubbed).toBe(0);
    },
  );

  testWithQueue()(
    'is a no-op when the reporter has no reports in the org',
    async ({ org, user, mrtService, addJob }) => {
      await addJob({
        itemId: uuidv1(),
        reportHistory: [
          {
            reportId: uuidv1(),
            reportedAt: new Date(),
            reporterId: { typeId: 'user_type', id: 'someone_else' },
            reason: 'spam',
          },
        ],
      });

      const result = await mrtService.invalidateReportsFromReporter({
        orgId: org.id,
        reporter: { typeId: 'user_type', id: 'bad' },
        invokedBy: invoker(org.id, user.id),
      });

      expect(result.jobsScrubbed).toBe(0);
      expect(result.jobsDeleted).toBe(0);
      expect(result.reportsRemoved).toBe(0);
      expect(result.jobsScanned).toBe(1);
    },
  );
});
