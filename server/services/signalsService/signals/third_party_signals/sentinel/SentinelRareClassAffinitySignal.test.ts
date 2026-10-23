import { ScalarTypes } from '@roostorg/coop-types';
import { afterEach, beforeEach, vi, type Mock } from 'vitest';

import { jsonParse } from '../../../../../utils/encoding.js';
import { type ItemInvestigationService } from '../../../../itemInvestigationService/index.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import { Integration } from '../../../types/Integration.js';
import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import { type SignalInput } from '../../SignalBase.js';
import SentinelRareClassAffinitySignal from './SentinelRareClassAffinitySignal.js';

type SentinelSignalInput = SignalInput<
  ScalarTypes['STRING'],
  false,
  false,
  string,
  'SENTINEL_RARE_CLASS_AFFINITY'
>;

function makeInput(
  overrides: Partial<SentinelSignalInput> = {},
): SentinelSignalInput {
  return {
    value: { type: 'STRING', value: 'test content' },
    matchingValues: undefined,
    actionPenalties: undefined,
    orgId: 'org-1',
    ...overrides,
  } as unknown as SentinelSignalInput;
}

const TEST_API_URL = 'http://sentinel.example.com:8000';

type FetchResponse = { ok: boolean; status: number; body: unknown };
type EndpointHandlers = {
  health?: () => FetchResponse;
  score?: () => FetchResponse;
};

/**
 * Fake `FetchHTTP` answering Sentinel's `/health` and `/score` (healthy and
 * scored by default), so tests go through `makeSentinelService` as in
 * production. Request history is read from `mock.calls`.
 */
function makeFetchHTTP(handlers: EndpointHandlers = {}) {
  type Req = { url: string; body?: string };
  const mockFetch = vi.fn(async (req: Req) => {
    if (req.url.endsWith('/health')) {
      return (
        handlers.health?.() ?? {
          ok: true,
          status: 200,
          body: { status: 'ok', banks_loaded: true },
        }
      );
    }
    if (req.url.endsWith('/score')) {
      return (
        handlers.score?.() ?? {
          ok: true,
          status: 200,
          body: {
            rare_class_affinity_score: 0.5,
            observation_scores: { 'test content': 0.5 },
            num_observations: 1,
          },
        }
      );
    }
    throw new Error(`Unexpected URL in test: ${req.url}`);
  });
  const requests = () => mockFetch.mock.calls.map(([req]) => req);
  return {
    fetchHTTP: mockFetch as unknown as FetchHTTP,
    lastScoreRequest: (): unknown => {
      const scoreRequest = requests()
        .filter((req) => req.url.endsWith('/score') && req.body != null)
        .at(-1);
      return scoreRequest ? jsonParse(scoreRequest.body as never) : undefined;
    },
    requestUrls: () => requests().map((req) => req.url),
  };
}

type MockItemInvestigationService = {
  insertItem: Mock;
  getThreadSubmissionsByPosition: Mock;
  getThreadSubmissionsByTime: Mock;
  getItemByIdentifier: Mock;
  getItemByTypeAgnosticIdentifier: Mock;
  getAncestorItems: Mock;
  getItemSubmissionsByCreator: Mock;
  getItemActionHistory: Mock;
};

function makeItemInvestigationService(
  overrides: Partial<MockItemInvestigationService> = {},
): MockItemInvestigationService {
  return {
    insertItem: vi.fn().mockResolvedValue(undefined),
    getThreadSubmissionsByPosition: vi.fn(),
    getThreadSubmissionsByTime: vi.fn().mockReturnValue(
      (async function* () {
        // Empty async iterable by default
      })(),
    ),
    getItemByIdentifier: vi.fn(),
    getItemByTypeAgnosticIdentifier: vi.fn(),
    getAncestorItems: vi.fn(),
    getItemSubmissionsByCreator: vi.fn(),
    getItemActionHistory: vi.fn(),
    ...overrides,
  };
}

/**
 * `orgConfig: undefined` means the org never enabled Sentinel; the default `{}`
 * means enabled with no overrides.
 */
function makeSignal(options?: {
  orgConfig?: Record<string, unknown> | undefined;
  fetchHTTP?: FetchHTTP;
  iisOverrides?: Partial<MockItemInvestigationService>;
}) {
  // Check key presence, since an explicit `undefined` orgConfig must differ
  // from a missing one. A provided config gets the test URL unless it sets
  // `apiUrl` itself (e.g. `apiUrl: undefined` for no URL).
  const opts = options ?? {};
  const rawOrgConfig: Record<string, unknown> | undefined =
    'orgConfig' in opts ? opts.orgConfig : {};
  const orgConfig =
    rawOrgConfig == null
      ? undefined
      : { apiUrl: TEST_API_URL, ...rawOrgConfig };
  const fetchHTTP = opts.fetchHTTP ?? makeFetchHTTP().fetchHTTP;

  return new SentinelRareClassAffinitySignal(
    vi.fn().mockResolvedValue(orgConfig),
    fetchHTTP,
    makeItemInvestigationService(
      opts.iisOverrides,
    ) as unknown as ItemInvestigationService,
  );
}

/** A minimal thread item, as yielded by `getThreadSubmissionsByTime`. */
function makeThreadItem(text: string) {
  return {
    latestSubmission: {
      data: { text },
      itemType: { kind: 'CONTENT', schema: [], schemaFieldRoles: {} },
    },
    priorSubmissions: undefined,
    parents: (async function* () {})(),
  };
}

describe('SentinelRareClassAffinitySignal', () => {
  beforeEach(() => {
    // Loopback URLs are rejected unless this is 'true'; pin it so tests do not
    // depend on the environment.
    vi.stubEnv('ALLOW_USER_INPUT_LOCALHOST_URIS', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('signal metadata', () => {
    it('returns correct id', () => {
      expect(makeSignal().id).toEqual({
        type: SignalType.SENTINEL_RARE_CLASS_AFFINITY,
      });
    });

    it('returns correct integration', () => {
      expect(makeSignal().integration).toBe(Integration.SENTINEL);
    });

    it('returns STRING as eligible input type', () => {
      expect(makeSignal().eligibleInputs).toEqual([ScalarTypes.STRING]);
    });

    it('returns NUMBER as output type', () => {
      expect(makeSignal().outputType).toEqual({
        scalarType: ScalarTypes.NUMBER,
      });
    });

    it('returns FREE pricing structure', () => {
      expect(makeSignal().pricingStructure).toBe(SignalPricingStructure.FREE);
    });

    it('is allowed in automated rules', () => {
      expect(makeSignal().allowedInAutomatedRules).toBe(true);
    });

    it('does not need matching values', () => {
      expect(makeSignal().needsMatchingValues).toBe(false);
    });

    it('does not need action penalties', () => {
      expect(makeSignal().needsActionPenalties).toBe(false);
    });

    it('has no eligible subcategories', () => {
      expect(makeSignal().eligibleSubcategories).toEqual([]);
    });

    it('returns ALL as supported languages', () => {
      expect(makeSignal().supportedLanguages).toBe('ALL');
    });
  });

  describe('getDisabledInfo', () => {
    it('returns disabled=false when service is healthy and banks are loaded', async () => {
      const info = await makeSignal().getDisabledInfo('org-1');
      expect(info.disabled).toBe(false);
    });

    it('returns disabled=true when the org has not enabled Sentinel', async () => {
      const signal = makeSignal({ orgConfig: undefined });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain(
        'not enabled for this organization',
      );
    });

    it('returns disabled=true when the org has not saved a URL', async () => {
      const signal = makeSignal({ orgConfig: { apiUrl: undefined } });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('No valid Sentinel API URL');
    });

    it.each([
      ['not a URL', 'not a url'],
      ['a non-http scheme', 'ftp://sentinel.example.com'],
      ['a loopback host', 'http://127.0.0.1:8000'],
    ])(
      'returns disabled=true and makes no request when the URL is %s',
      async (_label, apiUrl) => {
        const { fetchHTTP, requestUrls } = makeFetchHTTP();
        const signal = makeSignal({ fetchHTTP, orgConfig: { apiUrl } });
        const info = await signal.getDisabledInfo('org-1');
        expect(info.disabled).toBe(true);
        expect(info.disabledMessage).toContain('No valid Sentinel API URL');
        expect(requestUrls()).toEqual([]);
      },
    );

    it('returns disabled=true when health check fails', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        health: () => {
          throw new Error('Connection refused');
        },
      });
      const signal = makeSignal({ fetchHTTP });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('unavailable');
    });

    it('returns disabled=true when health status is not ok', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        health: () => ({
          ok: true,
          status: 200,
          body: { status: 'error', banks_loaded: false },
        }),
      });
      const signal = makeSignal({ fetchHTTP });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('not healthy');
    });

    it('returns disabled=true when banks are not loaded', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        health: () => ({
          ok: true,
          status: 200,
          body: { status: 'ok', banks_loaded: false },
        }),
      });
      const signal = makeSignal({ fetchHTTP });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('banks are not loaded');
    });
  });

  describe('run', () => {
    it('scores the primary text and returns rare_class_affinity_score', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP({
        score: () => ({
          ok: true,
          status: 200,
          body: {
            rare_class_affinity_score: 0.72,
            observation_scores: { 'test content': 0.72 },
            num_observations: 1,
          },
        }),
      });
      const signal = makeSignal({ fetchHTTP });

      const result = await signal.run(makeInput());

      expect(lastScoreRequest()).toMatchObject({
        texts: expect.arrayContaining(['test content']),
      });
      expect(result).toMatchObject({
        outputType: { scalarType: ScalarTypes.NUMBER },
        score: 0.72,
      });
    });

    it('returns an ERROR result when the org has not saved a URL', async () => {
      const signal = makeSignal({ orgConfig: { apiUrl: undefined } });
      const result = await signal.run(makeInput());
      expect(result.type).toBe('ERROR');
    });

    it("calls the org's configured apiUrl", async () => {
      const { fetchHTTP, requestUrls } = makeFetchHTTP();
      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { apiUrl: 'http://org-sentinel.internal:9000' },
      });

      await signal.run(makeInput());

      expect(
        requestUrls().some((url) =>
          url.startsWith('http://org-sentinel.internal:9000'),
        ),
      ).toBe(true);
    });

    it('forwards topK and minScoreToConsider overrides to the /score request', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();
      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { topK: 3, minScoreToConsider: 0.4 },
      });

      await signal.run(makeInput());

      expect(lastScoreRequest()).toMatchObject({
        top_k: 3,
        min_score_to_consider: 0.4,
      });
    });

    it('includes thread context texts when threadIdentifier is provided', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();

      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeThreadItem('prior thread message');
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = (lastScoreRequest() as { texts: string[] }).texts;
      expect(texts).toContain('test content');
      expect(texts).toContain('prior thread message');
    });

    it('passes a threadContextWindowMinutes override as an oldestReturnedSubmissionDate bound', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextWindowMinutes: 30 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      const before = Date.now();
      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      const call = getThreadSubmissionsByTime.mock.calls[0][0];
      expect(call.oldestReturnedSubmissionDate).toBeInstanceOf(Date);
      const windowMs = before - call.oldestReturnedSubmissionDate.getTime();
      // Should be ~30 minutes (allow slack for test execution time).
      expect(windowMs).toBeGreaterThan(30 * 60_000 - 5_000);
      expect(windowMs).toBeLessThan(30 * 60_000 + 5_000);
    });

    it('defaults to 10 prior messages (11 requested, since the trigger takes a slot)', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      expect(getThreadSubmissionsByTime.mock.calls[0][0].limit).toBe(11);
    });

    it('uses the org-level threadContextLimit override (plus one for the trigger)', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextLimit: 3 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      expect(getThreadSubmissionsByTime.mock.calls[0][0].limit).toBe(4);
    });

    it('ignores a non-positive org-level threadContextLimit and falls back to the default', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextLimit: -5 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      expect(getThreadSubmissionsByTime.mock.calls[0][0].limit).toBe(11);
    });

    it('caps an oversized threadContextLimit at 100 prior messages', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextLimit: 1_000_000 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      expect(getThreadSubmissionsByTime.mock.calls[0][0].limit).toBe(101);
    });

    it('ignores a non-positive threadContextWindowMinutes', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextWindowMinutes: -30 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      expect(
        getThreadSubmissionsByTime.mock.calls[0][0]
          .oldestReturnedSubmissionDate,
      ).toBeUndefined();
    });

    it('only scores thread messages up to the triggering submission time', async () => {
      const { fetchHTTP } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          // no items; only the call args matter
        })(),
      );
      const submissionTime = new Date('2026-01-01T00:00:00Z');

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            submissionTime,
          },
        }),
      );

      expect(
        getThreadSubmissionsByTime.mock.calls[0][0]
          .newestReturnedSubmissionDate,
      ).toEqual(submissionTime);
    });

    it('sends no more prior messages than the limit when the trigger is not echoed back', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeThreadItem('older 1');
          yield makeThreadItem('older 2');
          yield makeThreadItem('older 3');
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { threadContextLimit: 2 },
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      expect((lastScoreRequest() as { texts: string[] }).texts).toEqual([
        'test content',
        'older 1',
        'older 2',
      ]);
    });

    it('does not double-count the triggering submission when it is echoed back as thread context', async () => {
      // The triggering submission is already stored, so thread history can return it.
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();

      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeThreadItem('test content'); // echoed-back self item
          yield makeThreadItem('prior thread message');
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = (lastScoreRequest() as { texts: string[] }).texts;
      expect(texts).toEqual(['test content', 'prior thread message']);
    });

    it('only drops one occurrence of duplicate text, in case a genuine duplicate message exists', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();

      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeThreadItem('test content');
          yield makeThreadItem('test content');
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      const texts = (lastScoreRequest() as { texts: string[] }).texts;
      expect(texts).toEqual(['test content', 'test content']);
    });

    it('still returns a score when thread fetch fails', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockImplementation(() => {
        throw new Error('Scylla unavailable');
      });

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      const result = await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
          },
        }),
      );

      // Should still score with just the primary text
      expect(result).toMatchObject({ score: 0.5 });
      expect(lastScoreRequest()).toMatchObject({ texts: ['test content'] });
    });

    it('still returns a score when thread history fails partway through', async () => {
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();
      const getThreadSubmissionsByTime = vi.fn().mockReturnValue(
        (async function* () {
          yield makeThreadItem('earlier message');
          throw new Error('Scylla unavailable');
        })(),
      );

      const signal = makeSignal({
        fetchHTTP,
        iisOverrides: { getThreadSubmissionsByTime },
      });

      const result = await signal.run(
        makeInput({
          runtimeArgs: {
            threadIdentifier: { id: 'thread-1', typeId: 'content-type-1' },
            contentTextFieldName: 'text',
          },
        }),
      );

      expect(result).toMatchObject({ score: 0.5 });
      expect(lastScoreRequest()).toMatchObject({
        texts: ['test content', 'earlier message'],
      });
    });

    it('returns a permanent error result when Sentinel rejects the request with a 422', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        score: () => ({ ok: false, status: 422, body: 'Invalid request' }),
      });
      const signal = makeSignal({ fetchHTTP });
      const result = await signal.run(makeInput());
      expect(result).toMatchObject({
        type: 'ERROR',
        score: {
          name: 'SignalPermanentError',
          detail: 'Sentinel API error: status=422',
        },
      });
    });

    it.each([408, 429, 503])(
      'returns a permanent error result for a %i from Sentinel',
      async (status) => {
        const { fetchHTTP } = makeFetchHTTP({
          score: () => ({ ok: false, status, body: 'Try again' }),
        });
        const signal = makeSignal({ fetchHTTP });
        const result = await signal.run(makeInput());
        expect(result).toMatchObject({
          type: 'ERROR',
          score: {
            name: 'SignalPermanentError',
            detail: `Sentinel API error: status=${status}`,
          },
        });
      },
    );

    it('returns a permanent error result for a connection failure', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        score: () => {
          throw new Error('ECONNREFUSED');
        },
      });
      const signal = makeSignal({ fetchHTTP });
      const result = await signal.run(makeInput());
      expect(result).toMatchObject({
        type: 'ERROR',
        score: { name: 'SignalPermanentError' },
      });
    });

    it('returns a permanent error result for an out-of-range score', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        score: () => ({
          ok: true,
          status: 200,
          body: {
            rare_class_affinity_score: 7,
            observation_scores: {},
            num_observations: 1,
          },
        }),
      });
      const signal = makeSignal({ fetchHTTP });
      const result = await signal.run(makeInput());
      expect(result).toMatchObject({
        type: 'ERROR',
        score: { name: 'SignalPermanentError' },
      });
    });
  });
});
