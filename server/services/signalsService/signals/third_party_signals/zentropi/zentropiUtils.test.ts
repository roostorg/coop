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
    it('maps label=1, high confidence to high score (violating)', async () => {
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

    it('maps label=0, high confidence to low score (safe)', async () => {
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

    it('maps label=0, low confidence to ~0.4 (uncertain, leaning safe)', async () => {
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

    it('maps label=1, low confidence to 0.6 (uncertain, leaning violating)', async () => {
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
          e.title === 'Missing Zentropi labeler ID',
      );
      expect(fetchScores).not.toHaveBeenCalled();
    });

    it('throws a permanent error for entries saved without a labeler ID', async () => {
      const fetchScores: FetchZentropiScores = vi.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter('test-api-key', [
            { id: 'lv_abc123', label: 'Saved before labeler IDs' },
          ]),
          makeInput(),
          fetchScores,
        ),
      ).rejects.toSatisfy(
        (e) =>
          isCoopErrorOfType(e, 'SignalPermanentError') &&
          e.title === 'Missing Zentropi labeler ID',
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

    it('throws transient error for 5xx', async () => {
      const mockFetchHTTP = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as FetchHTTP;

      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerId: 'lb_123',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.toThrow('Zentropi API error: 500');

      // Verify it's NOT a SignalPermanentError
      await expect(
        getZentropiScores(mockFetchHTTP, {
          text: 'test',
          apiKey: 'key',
          labelerId: 'lb_123',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.not.toSatisfy((e) =>
        isCoopErrorOfType(e, 'SignalPermanentError'),
      );
    });

    it('returns parsed response on success', async () => {
      const mockResponse: ZentropiResponse = {
        label: 1,
        confidence: 0.85,
        explanation: 'Content violates policy',
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
      // Zentropi rejects requests that have a labeler_version_id but no
      // labeler_id.
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
  });
});
