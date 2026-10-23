/**
 * HTTP client for an org's own Sentinel instance. The URL comes from org
 * settings. Only scoring and health are exposed; loading banks is left to the
 * instance's operator.
 */
import { jsonStringify } from '../../utils/encoding.js';
import { type FetchHTTP } from '../networkingService/index.js';

export type SentinelScoreRequest = {
  texts: string[];
  top_k?: number;
  min_score_to_consider?: number;
};

export type SentinelScoreResponse = {
  rare_class_affinity_score: number;
  observation_scores: { [text: string]: number };
  num_observations: number;
};

export type SentinelHealthResponse = {
  status: string;
  banks_loaded: boolean;
  version?: string;
};

export class SentinelServiceError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, cause?: Error) {
    super(message, { cause });
    this.name = 'SentinelServiceError';
    this.statusCode = statusCode;
  }
}

export interface SentinelService {
  /** Score an array of texts for rare class affinity. */
  scoreTexts(request: SentinelScoreRequest): Promise<SentinelScoreResponse>;

  /** Check if the Sentinel service is healthy. */
  healthCheck(): Promise<SentinelHealthResponse>;
}

export function makeSentinelService(
  fetchHTTP: FetchHTTP,
  apiUrl: string,
): SentinelService {
  const baseUrl = apiUrl.replace(/\/$/, '');

  async function fetchWithError<T>(
    endpoint: string,
    options: { method: 'get' | 'post'; body?: string } = { method: 'get' },
  ): Promise<T> {
    try {
      const response = await fetchHTTP({
        url: `${baseUrl}${endpoint}`,
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: options.body,
        handleResponseBody: 'as-json',
        timeoutMs: 10_000,
      });

      if (!response.ok) {
        // Status only: the response body can echo back the text being scored.
        throw new SentinelServiceError(
          `Sentinel API error: status=${response.status}`,
          response.status,
        );
      }

      return response.body as T;
    } catch (error) {
      if (error instanceof SentinelServiceError) {
        throw error;
      }
      // The cause is kept for logs, but its message can quote the response body.
      throw new SentinelServiceError(
        'Failed to get a valid response from the Sentinel service',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  return {
    async scoreTexts(
      request: SentinelScoreRequest,
    ): Promise<SentinelScoreResponse> {
      const response = await fetchWithError<SentinelScoreResponse | undefined>(
        '/score',
        {
          method: 'post',
          body: jsonStringify({
            texts: request.texts,
            top_k: request.top_k ?? 5,
            min_score_to_consider: request.min_score_to_consider ?? 0.0,
          }),
        },
      );

      const score = response?.rare_class_affinity_score;
      if (
        response == null ||
        typeof score !== 'number' ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 1
      ) {
        throw new SentinelServiceError(
          'Sentinel API returned an invalid rare_class_affinity_score',
        );
      }

      return response;
    },

    async healthCheck(): Promise<SentinelHealthResponse> {
      const health = await fetchWithError<SentinelHealthResponse | undefined>(
        '/health',
        { method: 'get' },
      );
      if (
        typeof health?.status !== 'string' ||
        typeof health.banks_loaded !== 'boolean'
      ) {
        throw new SentinelServiceError(
          'Sentinel API returned an invalid health response',
        );
      }
      return health;
    },
  };
}

export default makeSentinelService;
