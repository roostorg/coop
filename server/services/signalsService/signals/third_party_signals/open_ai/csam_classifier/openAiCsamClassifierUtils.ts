import { ScalarTypes } from '@roostorg/coop-types';
import { type ReadonlyDeep } from 'type-fest';

import { jsonStringify } from '../../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../../utils/errors.js';
import { safeGet } from '../../../../../../utils/misc.js';
import type SafeTracer from '../../../../../../utils/SafeTracer.js';
import { type Bind2 } from '../../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { type GetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../../types/Integration.js';
import { type RecommendedThresholds } from '../../../../types/RecommendedThresholds.js';
import { SignalPricingStructure } from '../../../../types/SignalPricingStructure.js';
import {
  type SignalDisabledInfo,
  type SignalInput,
} from '../../../SignalBase.js';

/**
 * Categories scored by OpenAI's Novel CSAM Classifier. The classifier is
 * image-only and returns a 0..1 confidence score per category. These are the
 * response `category_scores` keys returned by the moderation endpoint for the
 * CSAM classifier model.
 */
export type OpenAiCsamCategory = 'likely-csam' | 'likely-csam/gen-ai';

// The CSAM classifier is served from the production Moderations endpoint under
// a dedicated model name, not a separate URL.
const OPEN_AI_CSAM_CLASSIFIER_URL = 'https://api.openai.com/v1/moderations';
const OPEN_AI_CSAM_CLASSIFIER_MODEL = 'omni-moderation-csam-latest';

/**
 * OpenAI's published default score threshold per CSAM signal (from the model
 * card). Single source of truth for both the recommended thresholds and the
 * model-card copy.
 */
export const OPEN_AI_CSAM_DEFAULT_THRESHOLDS = {
  'likely-csam': 0.996324,
  'likely-csam/gen-ai': 0.9,
} as const satisfies Record<OpenAiCsamCategory, number>;

export function openAiCsamClassifierDocsUrl() {
  return 'https://platform.openai.com/docs';
}

export function openAiCsamClassifierIntegration(): Integration | null {
  return Integration.OPEN_AI;
}

export function openAiCsamClassifierPricingStructure(): SignalPricingStructure {
  return SignalPricingStructure.FREE;
}

export function openAiCsamClassifierRecommendedThresholds(
  category: OpenAiCsamCategory,
): RecommendedThresholds {
  // OpenAI's model card publishes a single default threshold per signal, chosen
  // to balance recall and precision. It does not publish distinct
  // high-precision / high-recall values, so both use the published default.
  const threshold = OPEN_AI_CSAM_DEFAULT_THRESHOLDS[category];
  return {
    highPrecisionThreshold: threshold,
    highRecallThreshold: threshold,
  };
}

export function openAiCsamClassifierSupportedLanguages(): 'ALL' {
  return 'ALL';
}

export function openAiCsamClassifierEligibleSubcategories() {
  return [];
}

export function openAiCsamClassifierNeedsActionPenalties() {
  return false;
}

export function openAiCsamClassifierNeedsMatchingValues() {
  return false;
}

export async function openAiCsamClassifierGetDisabledInfo(
  orgId: string,
  getOpenAiCredentials: GetCredentials<'OPEN_AI'>,
): Promise<SignalDisabledInfo> {
  const credential = await getOpenAiCredentials(orgId);
  return !credential?.csamClassifierApiKey
    ? {
        disabled: true as const,
        disabledMessage: `OpenAI grants CSAM Classifier access through its intake process. Once your organization has access, add your CSAM Classifier API key in the OpenAI integration settings.`,
      }
    : { disabled: false as const };
}

/**
 * Pulls the requested category's numeric score out of a CSAM Classifier
 * response, with permanent-error guards: empty results and missing or
 * non-numeric category scores both mean the signal cannot determine a score
 * for the input, and retrying yields the same outcome — so we throw
 * `SignalPermanentError` to cache the rejection rather than spinning on
 * retries.
 */
function extractScoreOrThrow(
  response: ReadonlyDeep<OpenAiCsamClassifierResult[]>,
  category: OpenAiCsamCategory,
): number {
  if (response.length === 0) {
    throw makeSignalPermanentError('Empty OpenAI CSAM Classifier results', {
      shouldErrorSpan: true,
    });
  }
  const score = response[0].category_scores[category];
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw makeSignalPermanentError(
      `Missing or non-numeric score for category "${category}"`,
      { shouldErrorSpan: true },
    );
  }
  return score;
}

/**
 * Fetches the CSAM Classifier score for the given category against the
 * signal's image URL. The classifier authenticates with the org's CSAM
 * Classifier key, not the regular OpenAI API key — the two are issued
 * separately and the classifier key requires OpenAI approval.
 *
 * OpenAI fetches the image from the URL itself, so we pass the signal
 * input's URL through with no buffering or base64 encoding on our side.
 */
export async function runOpenAiCsamClassifierImageImpl(
  getOpenAiCredentials: GetCredentials<'OPEN_AI'>,
  input: SignalInput<ScalarTypes['IMAGE']>,
  getOpenAiCsamClassifierScores: FetchOpenAiCsamClassifierScores,
  category: OpenAiCsamCategory,
) {
  const { value, orgId } = input;
  const credential = await getOpenAiCredentials(orgId);

  if (!credential?.csamClassifierApiKey) {
    // Permanent: without a CSAM Classifier key, this signal can never
    // determine a score for this org; retrying the same call yields the same
    // failure. Caching the rejection avoids hammering the credential lookup
    // within a request.
    throw makeSignalPermanentError('Missing CSAM Classifier API credentials', {
      shouldErrorSpan: true,
    });
  }

  const response = await getOpenAiCsamClassifierScores({
    apiKey: credential.csamClassifierApiKey,
    imageUrl: value.value.url,
  });

  return {
    score: extractScoreOrThrow(response, category),
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}

export type FetchOpenAiCsamClassifierScores = Bind2<
  typeof getOpenAiCsamClassifierScores,
  FetchHTTP,
  SafeTracer
>;
type OpenAiCsamClassifierResult = {
  categories: { [k in OpenAiCsamCategory]: boolean };
  category_scores: { [k in OpenAiCsamCategory]: number };
  flagged: boolean;
};
type OpenAiCsamClassifierResponse = {
  results: OpenAiCsamClassifierResult[];
};

export async function getOpenAiCsamClassifierScores(
  fetchHTTP: FetchHTTP,
  tracer: SafeTracer,
  req: { apiKey: string; imageUrl: string },
): Promise<ReadonlyDeep<OpenAiCsamClassifierResult[]>> {
  const { apiKey, imageUrl } = req;
  const reqBody = {
    model: OPEN_AI_CSAM_CLASSIFIER_MODEL,
    input: [{ type: 'image_url', image_url: { url: imageUrl } }],
  };
  try {
    const response = await fetchHTTP({
      url: OPEN_AI_CSAM_CLASSIFIER_URL,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: jsonStringify(reqBody),
      handleResponseBody: 'as-json',
      isUntrustedUrl: false,
      // Same rationale as the moderation fetcher: this request runs as part
      // of processing an incoming item submission, so an unbounded request
      // pins the submission's memory until it resolves. A timeout trades
      // occasional signal failures for bounded memory.
      timeoutMs: 5_000,
    });

    if (!response.ok) {
      const message = `Request to OpenAI CSAM Classifier returned status ${response.status}`;
      // 4xx client errors (bad request, bad or unauthorized key) will not
      // succeed on retry, so cache the rejection. 429 (rate limit) and 5xx are
      // transient and stay retryable.
      if (
        response.status !== 429 &&
        response.status >= 400 &&
        response.status < 500
      ) {
        throw makeSignalPermanentError(message, { shouldErrorSpan: true });
      }
      throw Error(message);
    }
    const responseJson = response.body as OpenAiCsamClassifierResponse;
    if (!Array.isArray(responseJson?.results)) {
      throw makeSignalPermanentError(
        'OpenAI CSAM Classifier response had no results array',
        { shouldErrorSpan: true },
      );
    }
    return responseJson.results;
  } catch (e) {
    if (safeGet(e, ['name']) === 'ResponseExceededMaxSizeError') {
      throw makeSignalPermanentError('Response too large', {
        shouldErrorSpan: true,
      });
    }
    const activeSpan = tracer.getActiveSpan();
    if (activeSpan?.isRecording()) {
      activeSpan.recordException(e as Error);
    }
    throw e;
  }
}
