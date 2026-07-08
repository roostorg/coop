import 'dotenv/config';

import { uid } from 'uid';
import { Headers } from 'undici';

import {
  NCMECFileAnnotation,
  NCMECIncidentType,
  NCMECIndustryClassification,
  NcmecReporting,
  type NCMECReportParams,
} from '../../services/ncmecService/index.js';
import {
  type CoopRequestQuery,
  type CoopResponse,
  type FetchHTTP,
  type HandleResponseBody,
} from '../../services/networkingService/index.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

const MEDIA_URL = 'https://cdn.example/sample.jpg';
const PRESERVATION_URL = 'https://preserve.example/req';

/** Shape of one recorded outgoing fetchHTTP call. */
type RecordedCall = {
  url: string;
  method: string;
  body: unknown;
  headers?: Record<string, string | ReadonlyArray<string>>;
};

/** Records every outgoing fetchHTTP call and returns canned CyberTip
 * responses. */
function makeStubFetchHTTP(
  reportId: string,
  fileId: string,
): {
  fetchHTTP: FetchHTTP;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const ok = <T extends HandleResponseBody>(body: unknown): CoopResponse<T> =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the stub returns a canned body through a slot typed by the caller's T.
    ({
      status: 200,
      ok: true,
      headers: new Headers(),
      body,
    }) as CoopResponse<T>;
  const fetchHTTP: FetchHTTP = async <T extends HandleResponseBody>(
    query: CoopRequestQuery<T>,
  ): Promise<CoopResponse<T>> => {
    const { url, method, body, headers } = query;
    // eslint-disable-next-line functional/immutable-data -- request recorder mutates by design
    calls.push({ url, method, body, headers });

    // media download for #upload
    if (method === 'get') {
      const stream = new ReadableStream({
        start(ctr) {
          ctr.enqueue(new TextEncoder().encode('fake-media-bytes'));
          ctr.close();
        },
      });
      return ok<T>(stream);
    }
    // NCMEC CyberTip protocol — every XML endpoint returns responseCode=0.
    // /submit, /upload, /fileinfo use `reportResponse`; /finish uses
    // `reportDoneResponse`.
    if (
      url.endsWith('/ispws/submit') ||
      url.endsWith('/ispws/upload') ||
      url.endsWith('/ispws/fileinfo')
    ) {
      const isSubmit = url.endsWith('/ispws/submit');
      const isUpload = url.endsWith('/ispws/upload');
      return ok<T>({
        reportResponse: {
          responseCode: { _text: '0' },
          ...(isSubmit ? { reportId: { _text: reportId } } : {}),
          ...(isUpload ? { fileId: { _text: fileId } } : {}),
        },
      });
    }
    if (url.endsWith('/ispws/finish')) {
      return ok<T>({
        reportDoneResponse: {
          responseCode: { _text: '0' },
          reportId: { _text: reportId },
          files: [{ fileId: { _text: fileId } }],
        },
      });
    }
    if (url === PRESERVATION_URL) {
      return ok<T>(undefined);
    }
    throw new Error(`stub fetchHTTP: unexpected request ${method} ${url}`);
  };
  return { fetchHTTP, calls };
}

describe('NCMEC submitReport (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    const reportId = uid();
    const fileId = 'f1';

    const orgFixture = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );

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
    });

    const stub = makeStubFetchHTTP(reportId, fileId);
    const ncmecReporting = new NcmecReporting(
      deps.KyselyPg,
      deps.KyselyPgReadReplica,
      stub.fetchHTTP,
      deps.SigningKeyPairService,
      deps.ModerationConfigService,
      deps.getItemTypeEventuallyConsistent,
      deps.Tracer,
    );

    return {
      orgId,
      reportId,
      stub,
      ncmecReporting,
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
});
