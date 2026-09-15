import { uid } from 'uid';

import {
  HashBankService,
  HmaService,
} from '../../services/hmaService/index.js';
import {
  NCMECFileAnnotation,
  NCMECIncidentType,
  NCMECIndustryClassification,
  NcmecReporting,
  type NCMECReportParams,
} from '../../services/ncmecService/index.js';
import { jsonParse, type JsonOf } from '../../utils/encoding.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import {
  makeStubFetchHTTP,
  type RecordedFetchHTTPCall,
} from '../fixtureHelpers/makeStubFetchHTTP.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';
import { type MockedServer } from '../setupMockedServer.js';

const MEDIA_URL = 'https://cdn.example/sample.jpg';
const SECOND_MEDIA_URL = 'https://cdn.example/clip.mp4';
const PRESERVATION_URL = 'https://preserve.example/req';

type Deps = MockedServer['deps'];

function makeReporting(
  deps: Deps,
  reportId: string,
  stubOpts: { hmaAddContentStatus?: number } = {},
) {
  const stub = makeStubFetchHTTP(reportId, 'f1', {
    preservationUrl: PRESERVATION_URL,
    ...stubOpts,
  });
  const ncmecReporting = new NcmecReporting(
    deps.KyselyPg,
    deps.KyselyPgReadReplica,
    stub.fetchHTTP,
    deps.SigningKeyPairService,
    deps.ModerationConfigService,
    deps.getItemTypeEventuallyConsistent,
    deps.Tracer,
    new HmaService(stub.fetchHTTP, deps.KyselyPg),
  );
  return { stub, ncmecReporting };
}

function reportWithTwoMedia(
  orgId: string,
  userItemTypeId: string,
): NCMECReportParams {
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

function hmaAddContentCalls(calls: readonly RecordedFetchHTTPCall[]) {
  return calls.filter(
    (c) => c.method === 'post' && /\/c\/bank\/[^/]+\/content\?/.test(c.url),
  );
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

    const { stub, ncmecReporting } = makeReporting(deps, reportId);

    return {
      orgId,
      reportId,
      stub,
      ncmecReporting,
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
    'adds every reported media item to the selected hash bank once a production report is accepted',
    async ({
      ncmecReporting,
      orgId,
      reportId,
      stub,
      hashBank,
      userItemTypeId,
    }) => {
      const params = reportWithTwoMedia(orgId, userItemTypeId);

      const result = await ncmecReporting.submitReport(params, false);

      expect(result).toBe('SUCCESS');
      const addCalls = hmaAddContentCalls(stub.calls);
      expect(addCalls.map((c) => new URL(c.url).pathname)).toEqual([
        `/c/bank/${hashBank.hma_name}/content`,
        `/c/bank/${hashBank.hma_name}/content`,
      ]);
      expect(
        addCalls.map((c) => new URL(c.url).searchParams.get('url')).sort(),
      ).toEqual([SECOND_MEDIA_URL, MEDIA_URL].sort());
      const bodies = addCalls.map((c) => jsonParse(c.body as JsonOf<unknown>));
      expect(bodies).toContainEqual({
        metadata: {
          content_id: `${userItemTypeId}:media-1`,
          json: {
            source: 'ncmec_report',
            orgId,
            ncmecReportId: reportId,
            itemId: 'media-1',
            itemTypeId: userItemTypeId,
          },
        },
      });
    },
    60_000,
  );

  testWithFixture(
    'does not add anything to the hash bank for a test submission',
    async ({ ncmecReporting, orgId, stub, userItemTypeId }) => {
      const result = await ncmecReporting.submitReport(
        reportWithTwoMedia(orgId, userItemTypeId),
        true,
      );

      expect(result).toBe('SUCCESS');
      expect(hmaAddContentCalls(stub.calls)).toHaveLength(0);
    },
    60_000,
  );

  testWithFixture(
    'keeps the report successful and records no NCMEC error when HMA rejects the content',
    async ({ deps, orgId, reportId, userItemTypeId }) => {
      const { stub, ncmecReporting } = makeReporting(deps, reportId, {
        hmaAddContentStatus: 500,
      });
      const params = reportWithTwoMedia(orgId, userItemTypeId);

      const result = await ncmecReporting.submitReport(params, false);

      expect(result).toBe('SUCCESS');
      expect(hmaAddContentCalls(stub.calls)).toHaveLength(2);
      expect(stub.calls.some((c) => c.url === PRESERVATION_URL)).toBe(true);
      const errorRow = await deps.KyselyPg.selectFrom(
        'ncmec_reporting.ncmec_reports_errors',
      )
        .selectAll()
        .where('job_id', '=', params.jobId!)
        .executeTakeFirst();
      expect(errorRow).toBeUndefined();
    },
    60_000,
  );
});
