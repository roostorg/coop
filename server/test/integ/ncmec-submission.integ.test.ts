import { uid } from 'uid';

import { type ReportedMediaBankingEnqueueFn } from '../../queues/reportedMediaBankingQueue.js';
import { HashBankService } from '../../services/hmaService/index.js';
import {
  NCMECFileAnnotation,
  NCMECIncidentType,
  NCMECIndustryClassification,
  NcmecReporting,
  type NCMECReportParams,
} from '../../services/ncmecService/index.js';
import {
  type CoopRequestQuery,
  type FetchHTTP,
  type HandleResponseBody,
} from '../../services/networkingService/index.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import { makeStubFetchHTTP } from '../fixtureHelpers/makeStubFetchHTTP.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';
import { type MockedServer } from '../setupMockedServer.js';

const MEDIA_URL = 'https://cdn.example/sample.jpg';
const SECOND_MEDIA_URL = 'https://cdn.example/clip.mp4';
const PRESERVATION_URL = 'https://preserve.example/req';

type Deps = MockedServer['deps'];

function makeReporting(
  deps: Deps,
  reportId: string,
  onRequest?: (url: string) => Promise<void>,
  reportedMediaBankingEnqueue: ReportedMediaBankingEnqueueFn = jest.fn(),
) {
  const stub = makeStubFetchHTTP(reportId, 'f1', {
    preservationUrl: PRESERVATION_URL,
  });
  const fetchHTTP: FetchHTTP = async <T extends HandleResponseBody>(
    query: CoopRequestQuery<T>,
  ) => {
    await onRequest?.(query.url);
    return stub.fetchHTTP(query);
  };
  const ncmecReporting = new NcmecReporting(
    deps.KyselyPg,
    deps.KyselyPgReadReplica,
    fetchHTTP,
    deps.SigningKeyPairService,
    deps.ModerationConfigService,
    deps.getItemTypeEventuallyConsistent,
    deps.Tracer,
    reportedMediaBankingEnqueue,
  );
  return { stub, ncmecReporting, reportedMediaBankingEnqueue };
}

function reportWithTwoMedia(
  orgId: string,
  userItemTypeId: string,
): NCMECReportParams & { jobId: string } {
  return {
    orgId,
    reviewerId: 'reviewer-1',
    reportedUser: { id: uid(), typeId: userItemTypeId },
    media: [MEDIA_URL, SECOND_MEDIA_URL].map((url, i) => ({
      id: `media-${i + 1}`,
      typeId: userItemTypeId,
      url,
      createdAt: '2026-06-30T12:00:00.000Z',
      industryClassification: NCMECIndustryClassification.A1,
      fileAnnotations: [],
    })),
    threads: [],
    incidentType:
      NCMECIncidentType[
        'Child Pornography (possession, manufacture, and distribution)'
      ],
    jobId: `job-${uid()}`,
  };
}

describe('NCMEC submitReport (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    const reportId = uid();

    const orgFixture = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );

    const hashBank = await new HashBankService(deps.KyselyPg).create({
      name: 'Reported CSAM',
      hma_name: `COOP_TEST_${uid()}`,
      enabled_ratio: 1,
      org_id: orgId,
    });

    await deps.NcmecService.updateNcmecOrgSettings({
      orgId,
      username: 'espuser',
      password: 'esppass',
      contactEmail: 'reporter@example.com',
      moreInfoUrl: null,
      companyTemplate: 'AcmeESP',
      legalUrl: 'https://acme.example/legal',
      ncmecPreservationEndpoint: PRESERVATION_URL,
      ncmecAdditionalInfoEndpoint: null,
      defaultNcmecQueueId: null,
      defaultInternetDetailType: 'WEB_PAGE',
      termsOfService: null,
      contactPersonEmail: null,
      contactPersonFirstName: null,
      contactPersonLastName: null,
      contactPersonPhone: null,
      mediaReviewRequirement: 'ALL',
      minMediaToReview: null,
      reportedMediaHashBankId: hashBank.id,
    });

    const { stub, ncmecReporting, reportedMediaBankingEnqueue } = makeReporting(
      deps,
      reportId,
    );

    return {
      orgId,
      reportId,
      stub,
      ncmecReporting,
      reportedMediaBankingEnqueue,
      hashBank,
      userItemTypeId: orgFixture.defaultUserItemType.id,
    };
  });

  testWithFixture(
    'submitReport returns SUCCESS, persists a row, and runs submit→upload→fileinfo→finish',
    async ({ deps, ncmecReporting, orgId, reportId, stub, userItemTypeId }) => {
      const reportedUserId = uid();

      const reportParams: NCMECReportParams = {
        orgId,
        reviewerId: 'reviewer-1',
        reportedUser: {
          id: reportedUserId,
          typeId: userItemTypeId,
          displayName: 'Jane Doe',
          profilePicture: 'https://cdn.example/jane.png',
          ipAddress: '203.0.113.7',
          email: 'jane@example.com',
        },
        media: [
          {
            id: 'media-1',
            typeId: userItemTypeId,
            url: MEDIA_URL,
            createdAt: '2026-06-30T12:00:00.000Z',
            industryClassification: NCMECIndustryClassification.A1,
            fileAnnotations: [NCMECFileAnnotation.GENERATIVE_AI],
            hashes: {
              md5: 'd41d8cd98f00b204e9800998ecf8427e',
              pdq: 'pdqhash',
            },
          },
        ],
        threads: [],
        incidentType:
          NCMECIncidentType[
            'Child Pornography (possession, manufacture, and distribution)'
          ],
        jobId: 'job-1',
      };

      const result = await ncmecReporting.submitReport(reportParams, false);
      expect(result).toBe('SUCCESS');

      // protocol sequence — the full NCMEC submit flow
      const routes = stub.calls
        .filter((c) => c.url.includes('cybertip.org'))
        .map((c) => c.url.replace(/^.*\/ispws/, ''));
      expect(routes).toEqual(['/submit', '/upload', '/fileinfo', '/finish']);

      // preservation fired (isTest=false + endpoint set)
      expect(stub.calls.some((c) => c.url === PRESERVATION_URL)).toBe(true);

      // outgoing /submit request shape — proves the field-role-resolved email,
      // the incidentType, and the espIdentifier made it into the XML, and that
      // #sendCyberTipRequest set a Basic Authorization header.
      const submitCall = stub.calls.find(
        (c) => c.url.endsWith('/ispws/submit') && typeof c.body === 'string',
      );
      if (!submitCall) {
        throw new Error(
          'expected a /ispws/submit request with a string body, but none was recorded',
        );
      }
      const submitXml = String(submitCall.body);
      expect(submitXml).toContain('<incidentType>');
      expect(submitXml).toContain('jane@example.com');
      expect(submitCall.headers?.Authorization).toMatch(/^Basic /);

      // persisted row
      const row = await deps.KyselyPg.selectFrom(
        'ncmec_reporting.ncmec_reports',
      )
        .select(['report_id', 'is_test', 'report_xml'])
        .where('org_id', '=', orgId)
        .where('report_id', '=', reportId)
        .executeTakeFirst();
      expect(row).toBeDefined();
      expect(row?.is_test).toBe(false);
      expect(String(row?.report_xml)).toContain('jane@example.com');
    },
    60_000,
  );
  testWithFixture(
    'enqueues one banking job per reported media item once a production report is accepted',
    async ({
      ncmecReporting,
      reportedMediaBankingEnqueue,
      orgId,
      reportId,
      hashBank,
      userItemTypeId,
    }) => {
      const result = await ncmecReporting.submitReport(
        reportWithTwoMedia(orgId, userItemTypeId),
        false,
      );

      expect(result).toBe('SUCCESS');
      const job = (itemId: string, url: string) => ({
        orgId,
        hashBankId: hashBank.id,
        ncmecReportId: reportId,
        itemId,
        itemTypeId: userItemTypeId,
        url,
      });
      expect(reportedMediaBankingEnqueue).toHaveBeenCalledTimes(1);
      expect(reportedMediaBankingEnqueue).toHaveBeenCalledWith([
        job('media-1', MEDIA_URL),
        job('media-2', SECOND_MEDIA_URL),
      ]);
    },
    60_000,
  );

  testWithFixture(
    'uses the bank read before submitting, even if the setting is cleared during submission',
    async ({ deps, orgId, reportId, hashBank, userItemTypeId }) => {
      const { ncmecReporting, reportedMediaBankingEnqueue } = makeReporting(
        deps,
        reportId,
        async (url) => {
          if (url.endsWith('/ispws/submit')) {
            await deps.KyselyPg.updateTable(
              'ncmec_reporting.ncmec_org_settings',
            )
              .set({ reported_media_hash_bank_id: null })
              .where('org_id', '=', orgId)
              .execute();
          }
        },
      );

      const result = await ncmecReporting.submitReport(
        reportWithTwoMedia(orgId, userItemTypeId),
        false,
      );

      expect(result).toBe('SUCCESS');
      expect(reportedMediaBankingEnqueue).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ hashBankId: hashBank.id }),
        ]),
      );
    },
    60_000,
  );

  testWithFixture(
    'enqueues nothing when the org has no bank selected',
    async ({
      deps,
      ncmecReporting,
      reportedMediaBankingEnqueue,
      orgId,
      userItemTypeId,
    }) => {
      await deps.KyselyPg.updateTable('ncmec_reporting.ncmec_org_settings')
        .set({ reported_media_hash_bank_id: null })
        .where('org_id', '=', orgId)
        .execute();

      const result = await ncmecReporting.submitReport(
        reportWithTwoMedia(orgId, userItemTypeId),
        false,
      );

      expect(result).toBe('SUCCESS');
      expect(reportedMediaBankingEnqueue).not.toHaveBeenCalled();
    },
    60_000,
  );

  testWithFixture(
    'enqueues nothing for a test submission',
    async ({
      ncmecReporting,
      reportedMediaBankingEnqueue,
      orgId,
      userItemTypeId,
    }) => {
      const result = await ncmecReporting.submitReport(
        reportWithTwoMedia(orgId, userItemTypeId),
        true,
      );

      expect(result).toBe('SUCCESS');
      expect(reportedMediaBankingEnqueue).not.toHaveBeenCalled();
    },
    60_000,
  );

  testWithFixture(
    'keeps the report successful when the banking jobs cannot be enqueued',
    async ({ deps, orgId, reportId, userItemTypeId }) => {
      const { stub, ncmecReporting, reportedMediaBankingEnqueue } =
        makeReporting(
          deps,
          reportId,
          undefined,
          jest.fn().mockRejectedValue(new Error('Redis is down')),
        );
      const params = reportWithTwoMedia(orgId, userItemTypeId);

      const result = await ncmecReporting.submitReport(params, false);

      expect(result).toBe('SUCCESS');
      expect(reportedMediaBankingEnqueue).toHaveBeenCalledTimes(1);
      expect(stub.calls.some((c) => c.url === PRESERVATION_URL)).toBe(true);
      const errorRow = await deps.KyselyPg.selectFrom(
        'ncmec_reporting.ncmec_reports_errors',
      )
        .selectAll()
        .where('job_id', '=', params.jobId)
        .executeTakeFirst();
      expect(errorRow).toBeUndefined();
    },
    60_000,
  );
});
