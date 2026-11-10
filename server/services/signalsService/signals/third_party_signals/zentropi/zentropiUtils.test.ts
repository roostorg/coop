import { ScalarTypes } from '@roostorg/coop-types';
import { vi } from 'vitest';

import { jsonStringify } from '../../../../../utils/encoding.js';
import { isCoopErrorOfType } from '../../../../../utils/errors.js';
import { type FetchHTTP } from '../../../../networkingService/index.js';
import {
  type GetCredentials,
  type ZentropiLabelerVersion,
} from '../../../../signalAuthService/signalAuthService.js';
import { type SignalInput } from '../../SignalBase.js';
import {
  getZentropiScores,
  runZentropiLabelerImpl,
  type FetchZentropiScores,
  type ZentropiResponse,
} from './zentropiUtils.js';

type StringSignalInput = SignalInput<ScalarTypes['STRING']>;

function makeInput(
  overrides: Partial<StringSignalInput> = {},
): StringSignalInput {
  return {
    value: { type: 'STRING', value: 'test content' },
    matchingValues: undefined,
    actionPenalties: undefined,
    orgId: 'org-1',
    subcategory: 'lv_abc123',
    ...overrides,
  } as unknown as StringSignalInput;
}

function makeCredentialGetter(
  apiKey: string | null = 'test-api-key',
  labelerVersions: ZentropiLabelerVersion[] = [
    { id: 'lv_abc123', labelerId: 'lb_xyz789', label: 'Spam' },
    { id: 'lv_custom_123', labelerId: 'lb_custom', label: 'Custom' },
  ],
): GetCredentials<'ZENTROPI'> {
  return vi
    .fn<GetCredentials<'ZENTROPI'>>()
    .mockResolvedValue(apiKey ? { apiKey, labelerVersions } : undefined);
}

describe('zentropiUtils', () => {
  describe('score mapping', () => {
    it('maps label=1, high confidence to high score (match)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 1,
        confidence: 0.95,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBe(0.95);
    });

    it('maps label=0, high confidence to low score (no match)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 0,
        confidence: 0.95,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBeCloseTo(0.05);
    });

    it('maps label=0, low confidence to ~0.4 (uncertain, leaning no match)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 0,
        confidence: 0.6,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBeCloseTo(0.4);
    });

    it('maps label=1, low confidence to 0.6 (uncertain, leaning match)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 1,
        confidence: 0.6,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBe(0.6);
    });

    it('handles label as string "1" (API returns strings)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: '1',
        confidence: 0.95,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBe(0.95);
    });

    it('handles label as string "0" (API returns strings)', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: '0',
        confidence: 0.95,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.score).toBeCloseTo(0.05);
    });

    it('returns correct outputType', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 1,
        confidence: 0.9,
      } satisfies ZentropiResponse);

      const result = await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput(),
        fetchScores,
      );

      expect(result.outputType).toEqual({ scalarType: ScalarTypes.NUMBER });
    });
  });

  describe('error handling', () => {
    it('throws when missing credentials', async () => {
      const fetchScores: FetchZentropiScores = vi.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter(null),
          makeInput(),
          fetchScores,
        ),
      ).rejects.toThrow('Missing Zentropi API credentials');
    });

    it('throws when missing subcategory', async () => {
      const fetchScores: FetchZentropiScores = vi.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter(),
          makeInput({ subcategory: undefined }),
          fetchScores,
        ),
      ).rejects.toSatisfy(
        (e) =>
          isCoopErrorOfType(e, 'SignalPermanentError') &&
          e.title === 'Missing Zentropi labeler version',
      );
    });

    it('throws a permanent error when the subcategory is not configured', async () => {
      const fetchScores: FetchZentropiScores = vi.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter(),
          makeInput({ subcategory: 'lv_unknown' }),
          fetchScores,
        ),
      ).rejects.toSatisfy(
        (e) =>
          isCoopErrorOfType(e, 'SignalPermanentError') &&
          e.title === 'Missing Zentropi labeler version',
      );
      expect(fetchScores).not.toHaveBeenCalled();
    });

    it('passes the configured labeler and version IDs to fetcher', async () => {
      const fetchScores: FetchZentropiScores = vi.fn().mockResolvedValue({
        label: 0,
        confidence: 0.9,
      } satisfies ZentropiResponse);

      await runZentropiLabelerImpl(
        makeCredentialGetter(),
        makeInput({ subcategory: 'lv_custom_123' }),
        fetchScores,
      );

      expect(fetchScores).toHaveBeenCalledWith({
        text: 'test content',
        apiKey: 'test-api-key',
        labelerId: 'lb_custom',
        labelerVersionId: 'lv_custom_123',
      });
    });
  });

  describe('model selection', () => {
    async function requestBodyFor(model: ZentropiLabelerVersion['model']) {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: true,
        body: { label: 0, confidence: 0.9 },
      }) as unknown as FetchHTTP;

      await runZentropiLabelerImpl(
        makeCredentialGetter('test-api-key', [
          { id: 'lv_abc123', label: 'Saved version', model },
        ]),
        makeInput(),
        async (params) => getZentropiScores(mockFetchHTTP, params),
      );

      return vi.mocked(mockFetchHTTP).mock.calls[0][0].body;
    }

    it.each([
      ['COPE_LATEST', 'cope-latest'],
      ['COPE_B_A4B', 'cope-b-a4b'],
      ['COPE_B_S1', 'cope-b-s1'],
    ] as const)('sends %s as model %j', async (model, apiModelName) => {
      expect(await requestBodyFor(model)).toBe(
        jsonStringify({
          content_text: 'test content',
          labeler_version_id: 'lv_abc123',
          model: apiModelName,
        }),
      );
    });

    it.each([undefined, null])(
      'omits model when the saved version has model %j',
      async (model) => {
        expect(await requestBodyFor(model)).toBe(
          jsonStringify({
            content_text: 'test content',
            labeler_version_id: 'lv_abc123',
          }),
        );
      },
    );
  });

  describe('version-only configurations', () => {
    it.each([undefined, null, '', '   '])(
      'runs the saved version and omits labeler_id when it is %j',
      async (labelerId) => {
        const mockFetchHTTP = vi.fn().mockResolvedValue({
          ok: true,
          body: { label: 0, confidence: 0.9 },
        }) as unknown as FetchHTTP;
        const getCredentials = makeCredentialGetter('test-api-key', [
          { id: 'lv_abc123', label: 'Saved version', labelerId },
        ]);

        const result = await runZentropiLabelerImpl(
          getCredentials,
          makeInput(),
          async (params) => getZentropiScores(mockFetchHTTP, params),
        );

        expect(getCredentials).toHaveBeenCalledWith('org-1');
        expect(mockFetchHTTP).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            body: jsonStringify({
              content_text: 'test content',
              labeler_version_id: 'lv_abc123',
            }),
          }),
        );
        expect(result.score).toBeCloseTo(0.1);
      },
    );
  });

  describe('getZentropiScores', () => {
    it('returns SignalPermanentError for 404', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerId: 'lb_123',
          labelerVersionId: 'lv_bad',
        }),
      ).rejects.toSatisfy((e) => isCoopErrorOfType(e, 'SignalPermanentError'));
    });

    it('returns SignalPermanentError for 401', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'bad-key',
          labelerId: 'lb_123',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.toSatisfy((e) => isCoopErrorOfType(e, 'SignalPermanentError'));
    });

    it('does not retry a 422', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        body: { detail: 'bad request' },
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.toSatisfy((e) => isCoopErrorOfType(e, 'SignalPermanentError'));
      expect(mockFetchHTTP).toHaveBeenCalledTimes(1);
    });

    it('returns parsed response on success', async () => {
      const mockResponse: ZentropiResponse = {
        label: 1,
        confidence: 0.85,
        explanation: 'Content matches policy',
      };

      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      }) as unknown as FetchHTTP;

      const result = await getZentropiScores(mockFetchHTTP, {
        text: 'test content',
        apiKey: 'key',
        labelerId: 'lb_123',
        labelerVersionId: 'lv_123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetchHTTP).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.zentropi.ai/v1/label',
          method: 'post',
          headers: {
            Authorization: 'Bearer key',
            'Content-Type': 'application/json',
          },
          handleResponseBody: 'as-json',
          timeoutMs: 5_000,
        }),
      );
    });

    it('sends both labeler_id and labeler_version_id', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: true,
        body: { label: 0, confidence: 0.9 },
      }) as unknown as FetchHTTP;

      await getZentropiScores(mockFetchHTTP, {
        text: 'test content',
        apiKey: 'key',
        labelerId: 'lb_123',
        labelerVersionId: 'lv_123',
      });

      expect(mockFetchHTTP).toHaveBeenCalledWith(
        expect.objectContaining({
          body: jsonStringify({
            content_text: 'test content',
            labeler_id: 'lb_123',
            labeler_version_id: 'lv_123',
          }),
        }),
      );
    });

    it('returns SignalPermanentError with the API message for 422', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        body: {
          detail: [
            {
              type: 'value_error',
              loc: ['body'],
              msg: 'Value error, Exactly one of labeler_id or criteria_text must be provided',
            },
          ],
        },
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerId: 'lb_123',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.toSatisfy(
        (e) =>
          isCoopErrorOfType(e, 'SignalPermanentError') &&
          e.detail ===
            'Value error, Exactly one of labeler_id or criteria_text must be provided',
      );
    });

    it('returns SignalPermanentError with the API message for 400', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        body: { detail: 'Model cope-b-s1 not configured' },
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerVersionId: 'lv_123',
          model: 'COPE_B_S1',
        }),
      ).rejects.toSatisfy(
        (e) =>
          isCoopErrorOfType(e, 'SignalPermanentError') &&
          e.detail === 'Model cope-b-s1 not configured',
      );
    });
  });

  describe('retries', () => {
    const params = { text: 'test', apiKey: 'key', labelerVersionId: 'lv_123' };
    const ok = { ok: true, status: 200, body: { label: 1, confidence: 0.9 } };
    const failure = (status: number, headers: Record<string, string> = {}) => ({
      ok: false,
      status,
      body: { detail: 'Please slow down your requests' },
      headers: new Headers(headers),
    });

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retries a 429 with exponential backoff and then succeeds', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      let expectedCalls = 1;
      for (const delay of [250, 500, 1_000, 2_000]) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(mockFetchHTTP).toHaveBeenCalledTimes(expectedCalls);
        await vi.advanceTimersByTimeAsync(1);
        expectedCalls += 1;
        expect(mockFetchHTTP).toHaveBeenCalledTimes(expectedCalls);
      }

      await expect(pending).resolves.toEqual(ok.body);
      // Every attempt sends the same request.
      const bodies = vi
        .mocked(mockFetchHTTP)
        .mock.calls.map((call) => call[0].body);
      expect(new Set(bodies).size).toBe(1);
    });

    it('waits for Retry-After when it is longer than the backoff', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(429, { 'retry-after': '3' }))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      await vi.advanceTimersByTimeAsync(2_999);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toEqual(ok.body);
    });

    it('accepts an HTTP-date Retry-After', async () => {
      vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(
          failure(429, { 'retry-after': 'Mon, 09 Nov 2026 12:00:02 GMT' }),
        )
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toEqual(ok.body);
    });

    it('ignores an unparseable Retry-After', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(429, { 'retry-after': 'soon' }))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      await vi.advanceTimersByTimeAsync(250);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toEqual(ok.body);
    });

    it('caps the wait at five seconds', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(429, { 'retry-after': '120' }))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(2);
      await expect(pending).resolves.toEqual(ok.body);
    });

    it('gives up after five attempts with a transient error', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValue(failure(429)) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      // Attach the rejection handler before advancing timers.
      const outcome = pending.then(
        () => 'resolved',
        (e: unknown) => e,
      );
      await vi.advanceTimersByTimeAsync(250 + 500 + 1_000 + 2_000);
      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Zentropi API error: 429 (after 5 attempts)',
      );
      expect(isCoopErrorOfType(error, 'SignalPermanentError')).toBe(false);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(5);
    });

    it('retries a 529 (overloaded) the same way', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(529))
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      await vi.advanceTimersByTimeAsync(249);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(3);
      await expect(pending).resolves.toEqual(ok.body);
    });

    it('does not retry other server errors', async () => {
      const mockFetchHTTP = vi
        .fn()
        .mockResolvedValueOnce(failure(503))
        .mockResolvedValueOnce(ok) as unknown as FetchHTTP;

      const pending = getZentropiScores(mockFetchHTTP, params);
      const outcome = pending.then(
        () => 'resolved',
        (e: unknown) => e,
      );
      await vi.advanceTimersByTimeAsync(250 + 500 + 1_000 + 2_000);
      expect(await outcome).toBeInstanceOf(Error);
      expect(mockFetchHTTP).toHaveBeenCalledTimes(1);
    });
  });
});
