import { ScalarTypes } from '@roostorg/types';
import { type ReadonlyDeep } from 'type-fest';

import { jsonStringify } from '../../../../../../utils/encoding.js';
import { makeSignalPermanentError } from '../../../../../../utils/errors.js';
import { Language } from '../../../../../../utils/language.js';
import { safeGet } from '../../../../../../utils/misc.js';
import type SafeTracer from '../../../../../../utils/SafeTracer.js';
import { type Bind2 } from '../../../../../../utils/typescript-types.js';
import { type FetchHTTP } from '../../../../../networkingService/index.js';
import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../../types/Integration.js';
import { type RecommendedThresholds } from '../../../../types/RecommendedThresholds.js';
import { SignalPricingStructure } from '../../../../types/SignalPricingStructure.js';
import {
  type SignalDisabledInfo,
  type SignalInput,
} from '../../../SignalBase.js';

export type SupportedOpenAiInput = ScalarTypes['STRING'] | ScalarTypes['IMAGE'];

export type OpenAiModelName =
  | 'hate'
  | 'hate/threatening'
  | 'self-harm'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic';

/**
 * Categories that OpenAI's omni-moderation model scores for image inputs.
 * Other categories (e.g., hate, sexual/minors) are text-only — feeding an image
 * to those returns zero/undefined and would be misleading.
 *
 * See https://platform.openai.com/docs/guides/moderation#content-classifications
 */
export type OpenAiImageModelName = Extract<
  OpenAiModelName,
  'self-harm' | 'sexual' | 'violence' | 'violence/graphic'
>;

const OPEN_AI_MODERATION_MODEL = 'omni-moderation-latest';

export function openAiModerationDocsUrl() {
  return 'https://beta.openai.com/docs/guides/moderation/overview';
}

export function openAiModerationIntegration(): Integration | null {
  return Integration.OPEN_AI;
}

export function openAiModerationPricingStructure(): SignalPricingStructure {
  return SignalPricingStructure.SUBSCRIPTION;
}

export function openAiModerationRecommendedThresholds(): RecommendedThresholds | null {
  return {
    highPrecisionThreshold: 0.95,
    highRecallThreshold: 0.9,
  };
}

export function openAiModerationSupportedLanguages(): Language[] | 'ALL' {
  return [Language.ENGLISH];
}

export function openAiModerationEligibleSubcategories() {
  return [];
}

export function openAiModerationNeedsActionPenalties() {
  return false;
}

export async function openAiModerationGetDisabledInfo(
  orgId: string,
  getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
): Promise<SignalDisabledInfo> {
  const credential = await getOpenAiCredentials(orgId);
  return !credential?.apiKey
    ? {
        disabled: true as const,
        disabledMessage: `You need to input your OpenAI API key to use OpenAI's signals`,
      }
    : { disabled: false as const };
}

export function openAiModerationNeedsMatchingValues() {
  return false;
}

export async function runOpenAiModerationImpl(
  getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
  input: SignalInput<ScalarTypes['STRING']>,
  getOpenAiModerationScores: FetchOpenAiModerationScores,
  modelName: OpenAiModelName,
) {
  const { value, orgId } = input;
  const credential = await getOpenAiCredentials(orgId);

  if (!credential?.apiKey) {
    throw new Error('Missing API credentials');
  }

  const response = await getOpenAiModerationScores({
    apiKey: credential.apiKey,
    text: value.value,
  });

  if (response.length === 0) {
    throw new Error('Empty OpenAI results');
  }

  const scores = response[0];
  const score = scores.category_scores[modelName];
  return {
    score: Number(score),
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}

export async function runOpenAiModerationImageImpl(
  getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
  input: SignalInput<ScalarTypes['IMAGE']>,
  getOpenAiModerationScores: FetchOpenAiModerationScores,
  modelName: OpenAiImageModelName,
) {
  const { value, orgId } = input;
  const credential = await getOpenAiCredentials(orgId);

  if (!credential?.apiKey) {
    throw new Error('Missing API credentials');
  }

  // OpenAI's API fetches the image from the URL itself, so we just pass the
  // signal input's URL straight through (no buffer/base64 encoding needed).
  const response = await getOpenAiModerationScores({
    apiKey: credential.apiKey,
    imageUrl: value.value.url,
  });

  if (response.length === 0) {
    throw new Error('Empty OpenAI results');
  }

  const scores = response[0];
  const score = scores.category_scores[modelName];
  return {
    score: Number(score),
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}

export type FetchOpenAiModerationScores = Bind2<
  typeof getOpenAiModerationScores,
  FetchHTTP,
  SafeTracer
>;
type OpenAiModerationResult = {
  categories: { [k in OpenAiModelName]: boolean };
  category_scores: { [k in OpenAiModelName]: number };
  flagged: boolean;
};
type OpenAiModerationResponse = {
  results: OpenAiModerationResult[];
};

export async function getOpenAiModerationScores(
  fetchHTTP: FetchHTTP,
  tracer: SafeTracer,
  req: { apiKey: string; text?: string; imageUrl?: string },
): Promise<
  ReadonlyDeep<
    {
      categories: { [k in OpenAiModelName]: boolean };
      category_scores: { [k in OpenAiModelName]: number };
      flagged: boolean;
    }[]
  >
> {
  const { apiKey, text, imageUrl } = req;
  if (text == null && imageUrl == null) {
    throw new Error(
      'OpenAI moderation request must include `text` or `imageUrl`',
    );
  }
  // omni-moderation-latest's multimodal input is an array of typed parts.
  // We use the array shape unconditionally (rather than the legacy plain
  // string form) so the text and image paths are symmetric.
  const input: (
    | { type: 'text'; text: string }
    | {
        type: 'image_url';
        image_url: { url: string };
      }
  )[] = [];
  if (text != null) {
    input.push({ type: 'text', text });
  }
  if (imageUrl != null) {
    input.push({ type: 'image_url', image_url: { url: imageUrl } });
  }
  const reqBody = { model: OPEN_AI_MODERATION_MODEL, input };
  try {
    const response = await fetchHTTP({
      url: 'https://api.openai.com/v1/moderations',
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: jsonStringify(reqBody),
      handleResponseBody: 'as-json',
      // This request is made as part of running Rules on an incoming item
      // submission, so, if it takes a long time, the server's memory usage
      // grows a lot and things grind to a halt (because the memory for the
      // item submission and the rule engine state can't be reclaimed). Having
      // a timeout prevents that, at the expense of occasional, very
      // acceptable, signal failures. This'll be solved more rigorously once
      // the API server's item processing speed controls the rate at which it
      // dequeues item submissions to process.
      timeoutMs: 5_000,
    });

    if (!response.ok) {
      throw Error(
        `Request to OpenAI Signal threw an error with status code ${response.status}`,
      );
    }
    const responseJson = response.body as OpenAiModerationResponse;
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
