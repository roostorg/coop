/**
 * Integration test: the banking round trip.
 *
 * `reportedMediaBankingEnqueue` -> Redis -> `ReportedMediaBankingWorker` ->
 * `HmaService`, with only the HTTP layer stubbed. The unit tests mock
 * `hmaService` entirely, so a regression in the queue name, the job payload
 * shape or the BullMQ wiring would not show up anywhere else.
 *
 * Run with: docker compose run --rm test npm run test:integ
 * Requires: `npm run up && npm run db:update`
 */
import { uid } from 'uid';
import { Headers } from 'undici';

import { HashBankService } from '../../services/hmaService/index.js';
import {
  type CoopRequestQuery,
  type CoopResponse,
  type FetchHTTP,
  type HandleResponseBody,
} from '../../services/networkingService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';
import { waitFor } from './wait.js';

const MEDIA_URL = 'https://cdn.example/banked.jpg';

type RecordedCall = { url: string; method: string; body: unknown };

/** Stubs the two HMA calls the worker makes: the bank lookup in `getBankById`
 * and the content add. Anything else is a bug in the test, so it throws. */
function makeHmaStub() {
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
    const { url, method, body } = query;
    // eslint-disable-next-line functional/immutable-data -- request recorder mutates by design
    calls.push({ url, method, body });

    if (method === 'post' && url.includes('/content?')) {
      return ok<T>({ id: 1, signals: {} });
    }
    // getBankById verifies the bank still exists in HMA before returning it.
    if (method === 'get' && url.includes('/c/bank/')) {
      return ok<T>(undefined);
    }
    throw new Error(`stub fetchHTTP: unexpected request ${method} ${url}`);
  };

  return { fetchHTTP, calls };
}

describe('reported media banking round trip (integration)', () => {
  const orgId = uid();
  const ncmecReportId = uid();
  const itemId = `media-${uid()}`;
  const itemTypeId = `type-${uid()}`;
  let harness: IntegrationServer | undefined;
  let hma: ReturnType<typeof makeHmaStub>;
  let hmaName: string;
  let hashBankId: number;
  let orgCleanup: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    hma = makeHmaStub();
    harness = await makeIntegrationServer({
      mockedDeps: { fetchHTTP: hma.fetchHTTP },
      workers: ['ItemProcessingWorker', 'ReportedMediaBankingWorker'],
    });

    orgCleanup = (
      await createOrg(
        {
          KyselyPg: harness.deps.KyselyPg,
          ModerationConfigService: harness.deps.ModerationConfigService,
          ApiKeyService: harness.deps.ApiKeyService,
        },
        orgId,
      )
    ).cleanup;

    hmaName = `COOP_TEST_${uid()}`;
    hashBankId = (
      await new HashBankService(harness.deps.KyselyPg).create({
        name: 'Reported CSAM',
        hma_name: hmaName,
        enabled_ratio: 1,
        org_id: orgId,
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    try {
      await orgCleanup?.();
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('an enqueued job reaches HMA with the media url and metadata', async () => {
    if (!harness) throw new Error('harness was not initialized');

    await harness.deps.reportedMediaBankingEnqueue([
      {
        orgId,
        hashBankId,
        ncmecReportId,
        itemId,
        itemTypeId,
        url: MEDIA_URL,
      },
    ]);

    const addCall = await waitFor(
      `an HMA add-content call for bank ${hmaName}`,
      async () =>
        hma.calls.find(
          (c) => c.method === 'post' && c.url.includes(`/c/bank/${hmaName}/`),
        ) ?? null,
      { timeoutMs: 20_000 },
    );

    expect(addCall.url).toContain(`url=${encodeURIComponent(MEDIA_URL)}`);
    expect(addCall.body).toBe(
      jsonStringify({
        metadata: {
          content_id: `${itemTypeId}:${itemId}`,
          json: {
            source: 'ncmec_report',
            orgId,
            ncmecReportId,
            itemId,
            itemTypeId,
          },
        },
      }),
    );
  }, 60_000);
});
