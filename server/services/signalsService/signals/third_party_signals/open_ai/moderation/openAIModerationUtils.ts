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

export type SupportedOpenAiInput = ScalarTypes['STRING'];

export type OpenAiModelName =
  | 'hate'
  | 'hate/threatening'
  | 'self-harm'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic';

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

  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (!credential?.apiKey) {
    throw new Error('Missing API credentials');
  }

  const response = await getOpenAiModerationScores({
    text: value.value,
    apiKey: credential.apiKey,
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
  req: { apiKey: string; text: string },
): Promise<
  ReadonlyDeep<
    {
      categories: { [k in OpenAiModelName]: boolean };
      category_scores: { [k in OpenAiModelName]: number };
      flagged: boolean;
    }[]
  >
> {
  const { apiKey, text } = req;
  const reqBody = { input: text };
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
