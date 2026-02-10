import { ScalarTypes } from '@roostorg/types';

import { isCoopErrorOfType } from '../../../../../utils/errors.js';
import { type CachedGetCredentials } from '../../../../signalAuthService/signalAuthService.js';
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
  apiKey: string | undefined = 'test-api-key',
): CachedGetCredentials<'ZENTROPI'> {
  const fn = jest
    .fn()
    .mockResolvedValue(
      apiKey ? { apiKey } : undefined,
    ) as unknown as CachedGetCredentials<'ZENTROPI'>;
  fn.close = jest.fn().mockResolvedValue(undefined);
  return fn;
}

describe('zentropiUtils', () => {
  describe('score mapping', () => {
    it('maps label=1, high confidence to high score (violating)', async () => {
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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

    it('returns correct outputType', async () => {
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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
      const fetchScores: FetchZentropiScores = jest.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter(undefined),
          makeInput(),
          fetchScores,
        ),
      ).rejects.toThrow('Missing Zentropi API credentials');
    });

    it('throws when missing subcategory', async () => {
      const fetchScores: FetchZentropiScores = jest.fn();

      await expect(
        runZentropiLabelerImpl(
          makeCredentialGetter(),
          makeInput({ subcategory: undefined }),
          fetchScores,
        ),
      ).rejects.toThrow('Missing labeler_version_id in subcategory');
    });

    it('passes labelerVersionId from subcategory to fetcher', async () => {
      const fetchScores: FetchZentropiScores = jest.fn().mockResolvedValue({
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
        labelerVersionId: 'lv_custom_123',
      });
    });
  });

  describe('getZentropiScores', () => {
    it('returns SignalPermanentError for 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as jest.Mock;

      try {
        await getZentropiScores({
          text: 'test',
          apiKey: 'key',
          labelerVersionId: 'lv_bad',
        });
        fail('Expected error to be thrown');
      } catch (e) {
        expect(isCoopErrorOfType(e, 'SignalPermanentError')).toBe(true);
      }
    });

    it('returns SignalPermanentError for 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }) as jest.Mock;

      try {
        await getZentropiScores({
          text: 'test',
          apiKey: 'bad-key',
          labelerVersionId: 'lv_123',
        });
        fail('Expected error to be thrown');
      } catch (e) {
        expect(isCoopErrorOfType(e, 'SignalPermanentError')).toBe(true);
      }
    });

    it('throws transient error for 5xx', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as jest.Mock;

      await expect(
        getZentropiScores({
          text: 'test',
          apiKey: 'key',
          labelerVersionId: 'lv_123',
        }),
      ).rejects.toThrow('Zentropi API error: 500');

      // Verify it's NOT a SignalPermanentError
      try {
        await getZentropiScores({
          text: 'test',
          apiKey: 'key',
          labelerVersionId: 'lv_123',
        });
      } catch (e) {
        expect(isCoopErrorOfType(e, 'SignalPermanentError')).toBe(false);
      }
    });

    it('returns parsed response on success', async () => {
      const mockResponse: ZentropiResponse = {
        label: 1,
        confidence: 0.85,
        explanation: 'Content violates policy',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      }) as jest.Mock;

      const result = await getZentropiScores({
        text: 'test content',
        apiKey: 'key',
        labelerVersionId: 'lv_123',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.zentropi.ai/v1/label',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content_text: 'test content',
            labeler_version_id: 'lv_123',
          }),
        }),
      );
    });
  });
});
