import { type FetchHTTP } from '../networkingService/index.js';
import {
  makeSentinelService,
  SentinelServiceError,
  type SentinelBanksStatus,
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
  const mock = jest.fn();
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

    it('wraps fetch errors in SentinelServiceError', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      mock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const error = await service.healthCheck().catch((e) => e);
      expect(error).toBeInstanceOf(SentinelServiceError);
      expect(error.message).toContain('ECONNREFUSED');
    });
  });

  describe('getBanksStatus', () => {
    it('calls /banks/status and returns loaded status', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockStatus: SentinelBanksStatus = {
        loaded: true,
        model_name: 'all-MiniLM-L6-v2',
        positive_count: 100,
        negative_count: 200,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockStatus));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const result = await service.getBanksStatus();

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/banks/status`,
          method: 'get',
        }),
      );
      expect(result).toEqual(mockStatus);
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

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/score`,
          method: 'post',
          body: expect.stringContaining('hello world'),
        }),
      );
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
      expect(call.body).toContain('"top_k":5');
      expect(call.body).toContain('"min_score_to_consider":0');
    });
  });

  describe('scoreSingleText', () => {
    it('returns the score for the single text from observation_scores', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockScore: SentinelScoreResponse = {
        rare_class_affinity_score: 0.75,
        observation_scores: { 'test text': 0.75 },
        num_observations: 1,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockScore));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const score = await service.scoreSingleText('test text');
      expect(score).toBe(0.75);
    });

    it('returns 0 when observation_scores is empty', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockScore: SentinelScoreResponse = {
        rare_class_affinity_score: 0,
        observation_scores: {},
        num_observations: 0,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockScore));

      const service = makeSentinelService(fetchHTTP, BASE_URL);
      const score = await service.scoreSingleText('test text');
      expect(score).toBe(0);
    });
  });

  describe('default URL', () => {
    it('uses localhost:8000 when no URL is provided', async () => {
      const { fetchHTTP, mock } = makeFetchHTTPMock();
      const mockResponse: SentinelHealthResponse = {
        status: 'ok',
        banks_loaded: true,
      };
      mock.mockResolvedValueOnce(makeOkResponse(mockResponse));

      const service = makeSentinelService(fetchHTTP);
      await service.healthCheck();

      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:8000/health' }),
      );
    });

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
