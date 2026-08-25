/**
 * Sentinel Service — HTTP client for the Sentinel API.
 *
 * Sentinel is a contrastive-learning system for detecting rare text patterns
 * (e.g. grooming, hate speech) by comparing text against positive (rare/harmful)
 * and negative (common/normal) example banks.
 *
 * The factory does NOT read process.env directly — the caller passes in the
 * URL, keeping the module testable and DI-friendly.
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

export type SentinelBanksStatus = {
  loaded: boolean;
  model_name?: string;
  positive_count?: number;
  negative_count?: number;
  model_card?: Record<string, unknown>;
};

export type SentinelHealthResponse = {
  status: string;
  banks_loaded: boolean;
  version?: string;
};

export type SentinelLoadBanksRequest = {
  path: string;
  negative_to_positive_ratio?: number;
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

  /**
   * Score a single text for rare class affinity.
   * Returns the individual observation score for that text.
   */
  scoreSingleText(text: string): Promise<number>;

  /** Get the current banks status. */
  getBanksStatus(): Promise<SentinelBanksStatus>;

  /** Check if the Sentinel service is healthy. */
  healthCheck(): Promise<SentinelHealthResponse>;

  /** Load banks from a given path. */
  loadBanks(request: SentinelLoadBanksRequest): Promise<void>;

  /** Unload current banks from memory. */
  unloadBanks(): Promise<void>;
}

const DEFAULT_BASE_URL = 'http://localhost:8000';

export function makeSentinelService(
  fetchHTTP: FetchHTTP,
  apiUrl?: string,
): SentinelService {
  const baseUrl = (apiUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

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
        throw new SentinelServiceError(
          `Sentinel API error: ${jsonStringify(response.body)}`,
          response.status,
        );
      }

      return response.body as T;
    } catch (error) {
      if (error instanceof SentinelServiceError) {
        throw error;
      }
      throw new SentinelServiceError(
        `Failed to connect to Sentinel service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  return {
    async scoreTexts(
      request: SentinelScoreRequest,
    ): Promise<SentinelScoreResponse> {
      return fetchWithError<SentinelScoreResponse>('/score', {
        method: 'post',
        body: jsonStringify({
          texts: request.texts,
          top_k: request.top_k ?? 5,
          min_score_to_consider: request.min_score_to_consider ?? 0.0,
        }),
      });
    },

    async scoreSingleText(text: string): Promise<number> {
      const response = await this.scoreTexts({ texts: [text] });
      const scores = Object.values(response.observation_scores);
      return scores.length > 0 ? (scores[0] ?? 0) : 0;
    },

    async getBanksStatus(): Promise<SentinelBanksStatus> {
      return fetchWithError<SentinelBanksStatus>('/banks/status', {
        method: 'get',
      });
    },

    async healthCheck(): Promise<SentinelHealthResponse> {
      return fetchWithError<SentinelHealthResponse>('/health', {
        method: 'get',
      });
    },

    async loadBanks(request: SentinelLoadBanksRequest): Promise<void> {
      await fetchWithError<void>('/banks/load', {
        method: 'post',
        body: jsonStringify(request),
      });
    },

    async unloadBanks(): Promise<void> {
      await fetchWithError<void>('/banks/unload', {
        method: 'post',
      });
    },
  };
}

export default makeSentinelService;
