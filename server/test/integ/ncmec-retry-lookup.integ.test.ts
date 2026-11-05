import { uid } from 'uid';

import { NcmecReporting } from '../../services/ncmecService/index.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import { makeStubFetchHTTP } from '../fixtureHelpers/makeStubFetchHTTP.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

describe('NcmecReporting.getUsersWithNcmecDecision (integration)', () => {
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
    const insertReport = async (userId: string, isTest: boolean | null) =>
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
        })
        .execute();
    return { orgId, ncmecReporting, insertReport };
  });

  testWithFixture(
    'returns test and production reports, with the latest test report time',
    async ({ ncmecReporting, insertReport, orgId }) => {
      const [testUser, prodUser, legacyUser] = [uid(), uid(), uid()];
      await insertReport(testUser, true);
      await insertReport(prodUser, false);
      await insertReport(legacyUser, null);

      const rows = await ncmecReporting.getUsersWithNcmecDecision({
        startDate: new Date(Date.now() - 60 * 60 * 1000),
      });
      const byUser = new Map(
        rows.filter((r) => r.orgId === orgId).map((r) => [r.userId, r]),
      );

      expect(byUser.get(testUser)).toMatchObject({
        hasProductionReport: false,
        latestTestReportAt: expect.any(Date),
      });
      expect(byUser.get(prodUser)).toMatchObject({
        hasProductionReport: true,
        latestTestReportAt: null,
      });
      expect(byUser.get(legacyUser)).toMatchObject({
        hasProductionReport: true,
        latestTestReportAt: null,
      });
    },
  );
});
