import { uid } from 'uid';

import { NcmecReporting } from '../../services/ncmecService/index.js';
import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import { makeStubFetchHTTP } from '../fixtureHelpers/makeStubFetchHTTP.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

describe('NcmecReporting.getUsersWithNcmecDecision (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    const orgFixture = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );
    const ncmecReporting = new NcmecReporting(
      deps.DrizzlePg,
      deps.DrizzlePgReadReplica,
      makeStubFetchHTTP(uid(), 'f1').fetchHTTP,
      deps.SigningKeyPairService,
      deps.Tracer,
    );
    const userItemTypeId = orgFixture.defaultUserItemType.id;
    const insertReport = async (userId: string, isTest: boolean | null) =>
      deps.DrizzlePg.insert(schema.ncmecReports).values({
        orgId,
        reportId: uid(),
        userId,
        userItemTypeId,
        reportedMedia: [
          {
            id: uid(),
            typeId: userItemTypeId,
            xml: '<file/>',
            ncmecFileId: 'f1',
          },
        ],
        reportXml: '<report/>',
        additionalFiles: [],
        reportedMessages: [],
        ...(isTest === null ? {} : { isTest }),
      });
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
