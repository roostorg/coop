import { uid } from 'uid';

import {
  filterDecisionsToUnreported,
  NcmecReporting,
} from '../../services/ncmecService/index.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import { makeStubFetchHTTP } from '../fixtureHelpers/makeStubFetchHTTP.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

describe('NCMEC report coverage and attempt mode (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    const orgFixture = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );
    const ncmecReporting = new NcmecReporting(
      deps.KyselyPg,
      deps.KyselyPgReadReplica,
      makeStubFetchHTTP(uid(), 'f1').fetchHTTP,
      deps.SigningKeyPairService,
      deps.Tracer,
    );
    const userItemTypeId = orgFixture.defaultUserItemType.id;
    const insertReport = async (
      userId: string,
      isTest: boolean | null,
      jobId?: string,
    ) =>
      deps.KyselyPg.insertInto('ncmec_reporting.ncmec_reports')
        .values({
          org_id: orgId,
          report_id: uid(),
          user_id: userId,
          user_item_type_id: userItemTypeId,
          reported_media: [
            {
              id: uid(),
              typeId: userItemTypeId,
              xml: '<file/>',
              ncmecFileId: 'f1',
            },
          ],
          report_xml: '<report/>',
          additional_files: [],
          reported_messages: [],
          ...(isTest === null ? {} : { is_test: isTest }),
          ...(jobId === undefined ? {} : { job_id: jobId }),
        })
        .execute();
    return { orgId, ncmecReporting, insertReport, userItemTypeId };
  });

  testWithFixture(
    'summarizes reports per user and matches linked reports by job id',
    async ({ ncmecReporting, insertReport, orgId, userItemTypeId }) => {
      const [unlinkedTestUser, linkedTestUser, prodUser, legacyUser] = [
        uid(),
        uid(),
        uid(),
        uid(),
      ];
      const linkedJobId = uid();
      await insertReport(unlinkedTestUser, true);
      await insertReport(linkedTestUser, true, linkedJobId);
      await insertReport(prodUser, false, uid());
      await insertReport(legacyUser, null);

      const otherJobId = uid();
      const { reportedJobIds, users } =
        await ncmecReporting.getNcmecReportCoverage({
          jobIds: [linkedJobId, otherJobId],
          startDate: new Date(Date.now() - 60 * 60 * 1000),
          orgId,
        });

      expect([...reportedJobIds]).toEqual([linkedJobId]);
      const byUser = new Map(users.map((r) => [r.userId, r]));
      expect(byUser.size).toBe(4);
      expect(byUser.get(unlinkedTestUser)).toMatchObject({
        userItemTypeId,
        hasProductionReport: false,
        latestUnlinkedTestReportAt: expect.any(Date),
      });
      // A linked test report only covers its own decision, so it doesn't
      // count toward the unlinked timestamp rule.
      expect(byUser.get(linkedTestUser)).toMatchObject({
        hasProductionReport: false,
        latestUnlinkedTestReportAt: null,
      });
      expect(byUser.get(prodUser)).toMatchObject({
        hasProductionReport: true,
        latestUnlinkedTestReportAt: null,
      });
      // Rows from before is_test existed count as production.
      expect(byUser.get(legacyUser)).toMatchObject({
        hasProductionReport: true,
        latestUnlinkedTestReportAt: null,
      });
    },
  );

  testWithFixture(
    "a test report for one decision doesn't cover another decision on the same user",
    async ({ ncmecReporting, insertReport, orgId, userItemTypeId }) => {
      const userId = uid();
      const reportedJobId = uid();
      const failedJobId = uid();
      await insertReport(userId, true, reportedJobId);

      const decisionFor = (jobId: string) => ({
        jobId,
        orgId,
        userId,
        userItemTypeId,
        // Decided before the report was written.
        decidedAt: new Date(Date.now() - 60_000),
      });
      const coverage = await ncmecReporting.getNcmecReportCoverage({
        jobIds: [reportedJobId, failedJobId],
        orgId,
      });

      expect(
        filterDecisionsToUnreported(
          [decisionFor(reportedJobId), decisionFor(failedJobId)],
          coverage,
        ).map((d) => d.jobId),
      ).toEqual([failedJobId]);
    },
  );

  testWithFixture(
    'records the mode of the latest failed attempt',
    async ({ deps, ncmecReporting, userItemTypeId }) => {
      const jobId = uid();
      expect(await ncmecReporting.getLatestAttemptIsTest(jobId)).toBeNull();

      const recordError = async (isTest: boolean) =>
        deps.NcmecService.insertOrUpdateNcmecReportError({
          jobId,
          userId: uid(),
          userTypeId: userItemTypeId,
          status: 'RETRYABLE_ERROR',
          error: 'boom',
          isTest,
        });
      await recordError(true);
      expect(await ncmecReporting.getLatestAttemptIsTest(jobId)).toBe(true);
      await recordError(false);
      expect(await ncmecReporting.getLatestAttemptIsTest(jobId)).toBe(false);
    },
  );
});
