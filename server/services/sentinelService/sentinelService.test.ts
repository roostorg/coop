import { vi } from 'vitest';

import { jsonParse } from '../../utils/encoding.js';
import { type FetchHTTP } from '../networkingService/index.js';
import {
  makeSentinelService,
  SentinelServiceError,
  type SentinelHealthResponse,
  type SentinelScoreResponse,
} from './sentinelService.js';

function makeOkResponse<T>(body: T) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body,
  };
}

function makeErrorResponse(status: number, body: unknown = undefined) {
  return {
    ok: false,
    status,
    headers: new Headers(),
    body,
  };
}

function makeFetchHTTPMock() {
  const mock = vi.fn();
  return { fetchHTTP: mock as unknown as FetchHTTP, mock };
}

describe('makeSentinelService', () => {
  const BASE_URL = 'http://localhost:8000';

  describe('healthCheck', () => {
    it('calls /health endpoint and returns response', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockResponse: SentinelHealthResponse = {
        status: 'ok',
        banks_loaded: true,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockResponse));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const result = await service.healthCheck();

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${BASE_URL}/health`, method: 'get' }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws SentinelServiceError on non-ok response', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockResolvedValueOnce(makeErrorResponse(503));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      await expect(service.healthCheck()).rejects.toBeInstanceOf(
        SentinelServiceError,
      );
    });

    it('reports only the status code, never the response body', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockResolvedValueOnce(
        makeErrorResponse(422, { detail: 'echoed user text' }),
      );

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const error = await service.healthCheck().catch((e) => e);
      expect(error).toBeInstanceOf(SentinelServiceError);
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Sentinel API error: status=422');
      expect(error.message).not.toContain('echoed user text');
    });

    it('wraps fetch errors in SentinelServiceError', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const error = await service.healthCheck().catch((e) => e);
      expect(error).toBeInstanceOf(SentinelServiceError);
      expect(error.cause).toEqual(new Error('ECONNREFUSED'));
    });

    it('does not quote a failed fetch (for example a response body prefix) in the error message', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockRejectedValueOnce(
        new Error('Failed to parse response body. Body started with: secret'),
      );

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const error = await service.healthCheck().catch((e) => e);
      expect(error).toBeInstanceOf(SentinelServiceError);
      expect(error.message).not.toContain('secret');
    });

    it.each([
      ['missing', undefined],
      ['status is not a string', { status: 1, banks_loaded: true }],
      ['banks_loaded is a string', { status: 'ok', banks_loaded: 'false' }],
    ])('throws when the health response is %s', async (_label, body) => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockResolvedValueOnce(makeOkResponse(body as never));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      await expect(service.healthCheck()).rejects.toBeInstanceOf(
        SentinelServiceError,
      );
    });
  });

  describe('scoreTexts', () => {
    it('calls /score with the provided texts and returns scores', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockScore: SentinelScoreResponse = {
        rare_class_affinity_score: 0.82,
        observation_scores: { 'hello world': 0.82 },
        num_observations: 1,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockScore));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const result = await service.scoreTexts({ texts: ['hello world'] });

      const [call] = mock.mock.calls[0] as [{ url: string; body: string }];
      expect(call.url).toBe(`${BASE_URL}/score`);
      expect(jsonParse(call.body as never)).toMatchObject({
        texts: ['hello world'],
      });
      expect(result.rare_class_affinity_score).toBe(0.82);
    });

    it('includes default top_k and min_score_to_consider when not specified', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockScore: SentinelScoreResponse = {
        rare_class_affinity_score: 0.5,
        observation_scores: { text: 0.5 },
        num_observations: 1,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockScore));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      await service.scoreTexts({ texts: ['text'] });

      const [call] = mock.mock.calls[0] as [{ body: string }];
      const body = jsonParse(call.body as never) as {
        top_k: number;
        min_score_to_consider: number;
      };
      expect(body.top_k).toBe(5);
      expect(body.min_score_to_consider).toBe(0);
    });

    it.each([
      ['missing', undefined],
      ['not a number', '0.5'],
      ['NaN', NaN],
      ['negative', -0.1],
      ['above 1', 1.1],
    ])('throws when rare_class_affinity_score is %s', async (_label, score) => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockResolvedValueOnce(
        makeOkResponse({
          rare_class_affinity_score: score,
          observation_scores: {},
          num_observations: 0,
        }),
      );

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      await expect(
        service.scoreTexts({ texts: ['text'] }),
      ).rejects.toBeInstanceOf(SentinelServiceError);
    });

    it('throws when the response body is empty', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockResolvedValueOnce(makeOkResponse(undefined));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      await expect(
        service.scoreTexts({ texts: ['text'] }),
      ).rejects.toBeInstanceOf(SentinelServiceError);
    });
  });

  describe('base URL', () => {
    it('strips trailing slash from base URL', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockResponse: SentinelHealthResponse = {
        status: 'ok',
        banks_loaded: true,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockResponse));

      const service = makeSentinelService(
        fetchHTTP,
        'http://sentinel.example.com/',
      );
      await service.healthCheck();

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://sentinel.example.com/health',
        }),
      );
    });
  });
});
