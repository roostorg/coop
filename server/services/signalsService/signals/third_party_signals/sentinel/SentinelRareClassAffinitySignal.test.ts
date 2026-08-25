import { ScalarTypes } from '@roostorg/types';

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

type FetchResponse = { ok: boolean; status: number; body: unknown };
type EndpointHandlers = {
  health?: () => FetchResponse;
  banksStatus?: () => FetchResponse;
  score?: () => FetchResponse;
};

/**
 * Builds a fake `FetchHTTP` that answers Sentinel's `/health`, `/banks/status`,
 * and `/score` endpoints (all healthy/loaded/scored by default), so tests can
 * exercise the signal through `makeSentinelService` the same way it's wired
 * in production, rather than mocking a `SentinelService` instance directly.
 *
 * Request history is read back from Jest's own `mock.calls`, rather than a
 * hand-rolled accumulator, so nothing here mutates an array in place.
 */
function makeFetchHTTP(handlers: EndpointHandlers = {}) {
  type Req = { url: string; body?: string };
  const mockFetch = jest.fn(async (req: Req) => {
    if (req.url.endsWith('/health')) {
      return (
        handlers.health?.() ?? {
          ok: true,
          status: 200,
          body: { status: 'ok', banks_loaded: true },
        }
      );
    }
    if (req.url.endsWith('/banks/status')) {
      return (
        handlers.banksStatus?.() ?? {
          ok: true,
          status: 200,
          body: { loaded: true },
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
  insertItem: jest.Mock;
  getThreadSubmissionsByPosition: jest.Mock;
  getThreadSubmissionsByTime: jest.Mock;
  getItemByIdentifier: jest.Mock;
  getItemByTypeAgnosticIdentifier: jest.Mock;
  getAncestorItems: jest.Mock;
  getItemSubmissionsByCreator: jest.Mock;
  getItemActionHistory: jest.Mock;
};

function makeItemInvestigationService(
  overrides: Partial<MockItemInvestigationService> = {},
): MockItemInvestigationService {
  return {
    insertItem: jest.fn().mockResolvedValue(undefined),
    getThreadSubmissionsByPosition: jest.fn(),
    getThreadSubmissionsByTime: jest.fn().mockReturnValue(
      (async function* () {
        // Empty async iterable by default
      })(),
    ),
    getItemByIdentifier: jest.fn(),
    getItemByTypeAgnosticIdentifier: jest.fn(),
    getAncestorItems: jest.fn(),
    getItemSubmissionsByCreator: jest.fn(),
    getItemActionHistory: jest.fn(),
    ...overrides,
  };
}

/**
 * `undefined` (the default) means the org has enabled Sentinel with no
 * overrides — i.e. `getByIntegrationId` returned `{}`, which is distinct
 * from the org never having enabled the integration at all (`undefined`).
 */
function makeSignal(options?: {
  orgConfig?: Record<string, unknown> | undefined;
  fetchHTTP?: FetchHTTP;
  iisOverrides?: Partial<MockItemInvestigationService>;
  defaultApiUrl?: string | undefined;
}) {
  // Destructuring defaults trigger on an explicit `undefined` value, not
  // just a missing key — and tests need to distinguish "not provided,
  // use the default" from "explicitly no org config / no default URL". So
  // check key presence instead of using destructuring defaults for these two.
  const opts = options ?? {};
  const orgConfig: Record<string, unknown> | undefined =
    'orgConfig' in opts ? opts.orgConfig : {};
  const defaultApiUrl: string | undefined =
    'defaultApiUrl' in opts ? opts.defaultApiUrl : 'http://localhost:8000';
  const fetchHTTP = opts.fetchHTTP ?? makeFetchHTTP().fetchHTTP;

  return new SentinelRareClassAffinitySignal(
    jest.fn().mockResolvedValue(orgConfig),
    fetchHTTP,
    makeItemInvestigationService(
      opts.iisOverrides,
    ) as unknown as ItemInvestigationService,
    defaultApiUrl,
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

    it('returns disabled=true when no URL is configured at all', async () => {
      const signal = makeSignal({ orgConfig: {}, defaultApiUrl: undefined });
      const info = await signal.getDisabledInfo('org-1');
      expect(info.disabled).toBe(true);
      expect(info.disabledMessage).toContain('No Sentinel API URL');
    });

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
        banksStatus: () => ({ ok: true, status: 200, body: { loaded: false } }),
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

    it('returns an ERROR result when neither org config nor a default URL is set', async () => {
      const signal = makeSignal({ orgConfig: {}, defaultApiUrl: undefined });
      const result = await signal.run(makeInput());
      expect(result.type).toBe('ERROR');
    });

    it("uses the org's configured apiUrl instead of the deployment default", async () => {
      const { fetchHTTP, requestUrls } = makeFetchHTTP();
      const signal = makeSignal({
        fetchHTTP,
        orgConfig: { apiUrl: 'http://org-sentinel.internal:9000' },
        defaultApiUrl: 'http://localhost:8000',
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

      const getThreadSubmissionsByTime = jest.fn().mockReturnValue(
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
      const getThreadSubmissionsByTime = jest.fn().mockReturnValue(
        (async function* () {
          // no items needed; we're only asserting on the call args
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

    it('does not double-count the triggering submission when it is echoed back as thread context', async () => {
      // submitContent.ts writes the current submission to Scylla before
      // running rules, so getThreadSubmissionsByTime (which is time-bounded,
      // not identity-bounded) can return the very submission that triggered
      // this signal run alongside genuine prior messages.
      const { fetchHTTP, lastScoreRequest } = makeFetchHTTP();

      const getThreadSubmissionsByTime = jest.fn().mockReturnValue(
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

      const getThreadSubmissionsByTime = jest.fn().mockReturnValue(
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
      const getThreadSubmissionsByTime = jest.fn().mockImplementation(() => {
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

    it('returns an error result when Sentinel service returns a non-ok response', async () => {
      const { fetchHTTP } = makeFetchHTTP({
        score: () => ({ ok: false, status: 503, body: 'Banks not loaded' }),
      });
      const signal = makeSignal({ fetchHTTP });
      const result = await signal.run(makeInput());
      expect(result.type).toBe('ERROR');
    });
  });
});
