import { ScalarTypes } from '@roostorg/coop-types';
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
import { type SignalType } from '../../../../types/SignalType.js';
import SignalBase, {
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

/**
 * Pulls the requested category's numeric score out of an OpenAI moderation
 * response, with permanent-error guards: empty results (the response had no
 * scoring object) and missing/non-numeric category scores both mean the
 * signal cannot determine a score for the input, and retrying yields the
 * same outcome — so we throw `SignalPermanentError` to cache the rejection
 * rather than spinning on retries.
 */
function extractScoreOrThrow(
  response: ReadonlyDeep<OpenAiModerationResult[]>,
  modelName: OpenAiModelName,
): number {
  if (response.length === 0) {
    throw makeSignalPermanentError('Empty OpenAI moderation results', {
      shouldErrorSpan: true,
    });
  }
  const score = response[0].category_scores[modelName];
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw makeSignalPermanentError(
      `Missing or non-numeric score for category "${modelName}"`,
      { shouldErrorSpan: true },
    );
  }
  return score;
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
    // Permanent: without an API key, this signal can never determine a score
    // for this org; retrying the same call yields the same failure. Caching
    // the rejection avoids hammering the credential lookup within a request.
    throw makeSignalPermanentError('Missing API credentials', {
      shouldErrorSpan: true,
    });
  }

  const response = await getOpenAiModerationScores({
    apiKey: credential.apiKey,
    text: value.value,
  });

  return {
    score: extractScoreOrThrow(response, modelName),
    outputType: { scalarType: ScalarTypes.NUMBER },
  };
}

/**
 * Image-input counterpart to {@link runOpenAiModerationImpl}. Fetches an
 * omni-moderation score for the given category against the signal's image
 * URL.
 *
 * Constrains `modelName` to {@link OpenAiImageModelName} so callers can't
 * accidentally request a category OpenAI only scores against text — those
 * would silently return zero.
 *
 * OpenAI fetches the image from the URL itself, so we just pass the signal
 * input's URL through with no buffering or base64 encoding on our side.
 */
export async function runOpenAiModerationImageImpl(
  getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
  input: SignalInput<ScalarTypes['IMAGE']>,
  getOpenAiModerationScores: FetchOpenAiModerationScores,
  modelName: OpenAiImageModelName,
) {
  const { value, orgId } = input;
  const credential = await getOpenAiCredentials(orgId);

  if (!credential?.apiKey) {
    // Permanent: without an API key, this signal can never determine a score
    // for this org; retrying the same call yields the same failure. Caching
    // the rejection avoids hammering the credential lookup within a request.
    throw makeSignalPermanentError('Missing API credentials', {
      shouldErrorSpan: true,
    });
  }

  // OpenAI's API fetches the image from the URL itself, so we just pass the
  // signal input's URL straight through (no buffer/base64 encoding needed).
  const response = await getOpenAiModerationScores({
    apiKey: credential.apiKey,
    imageUrl: value.value.url,
  });

  return {
    score: extractScoreOrThrow(response, modelName),
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
    // Permanent: with neither text nor imageUrl there is nothing to score, and
    // a retry on the same input would fail the same way. In practice this is
    // a caller bug (the typed entry points always pass one or the other).
    throw makeSignalPermanentError(
      'OpenAI moderation request must include `text` or `imageUrl`',
      { shouldErrorSpan: true },
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

/**
 * Factory for OpenAI image-moderation signals. All four image signals
 * (`violence`, `violence/graphic`, `self-harm`, `sexual`) share identical
 * boilerplate: same integration, pricing, language coverage, eligible inputs,
 * etc. — the only per-signal config is the SignalType id, display name,
 * description, and the model category to read.
 *
 * Returns a `SignalBase` subclass that the IoC container instantiates with
 * `(credentials, scores)` like any other signal class, preserving the
 * existing registration pattern in `instantiateBuiltInSignals.ts`.
 */
export function makeOpenAiImageModerationSignal(config: {
  type: SignalType;
  displayName: string;
  description: string;
  modelName: OpenAiImageModelName;
}) {
  return class OpenAiImageModerationSignal extends SignalBase<
    ScalarTypes['IMAGE'],
    { scalarType: ScalarTypes['NUMBER'] }
  > {
    constructor(
      protected readonly getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
      protected readonly getOpenAiScores: FetchOpenAiModerationScores,
    ) {
      super();
    }

    override get id() {
      return { type: config.type };
    }

    override get displayName() {
      return config.displayName;
    }

    override get description() {
      return config.description;
    }

    override get docsUrl() {
      return openAiModerationDocsUrl();
    }

    override get integration() {
      return openAiModerationIntegration();
    }

    override get pricingStructure() {
      return openAiModerationPricingStructure();
    }

    override get recommendedThresholds() {
      return openAiModerationRecommendedThresholds();
    }

    override get supportedLanguages() {
      return openAiModerationSupportedLanguages();
    }

    override get eligibleSubcategories() {
      return openAiModerationEligibleSubcategories();
    }

    override get needsActionPenalties() {
      return openAiModerationNeedsActionPenalties();
    }

    override get needsMatchingValues() {
      return openAiModerationNeedsMatchingValues();
    }

    override async getDisabledInfo(orgId: string) {
      return openAiModerationGetDisabledInfo(orgId, this.getOpenAiCredentials);
    }

    override get eligibleInputs() {
      return [ScalarTypes.IMAGE];
    }

    override get outputType() {
      return { scalarType: ScalarTypes.NUMBER };
    }

    // Inherits the placeholder cost convention from the existing OpenAI text
    // signals (see OpenAiViolenceTextSignal etc.). Cost units are unitless
    // ordering hints used by the engine to prefer cheaper signals; the
    // current ~20 baseline reflects that OpenAI moderation is a paid
    // remote-API call (vs. local heuristics) — not a calibrated value.
    override getCost() {
      return 20;
    }

    override get allowedInAutomatedRules() {
      return true;
    }

    /**
     * Fetches the omni-moderation `${config.modelName}` score for the image
     * and returns it as a number between 0 and 1.
     */
    async run(input: SignalInput<ScalarTypes['IMAGE']>) {
      return runOpenAiModerationImageImpl(
        this.getOpenAiCredentials,
        input,
        this.getOpenAiScores,
        config.modelName,
      );
    }
  };
}
