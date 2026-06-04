/**
 * Factories for OpenAI moderation signals. Collapses the boilerplate that
 * was duplicated across every per-category signal class — id, displayName,
 * description, integration, pricing, languages, cost, etc. The two public
 * exports (`makeOpenAiImageModerationSignal`,
 * `makeOpenAiTextModerationSignal`) are thin wrappers around the private
 * `makeOpenAiModerationSignal` so the class body lives in one place.
 *
 * The IoC container instantiates the returned class with
 * `(credentials, scores)` like any other signal, preserving the existing
 * registration pattern in `instantiateBuiltInSignals.ts`.
 */
import { ScalarTypes } from '@roostorg/types';

import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { type SignalType } from '../../../../types/SignalType.js';
import SignalBase, {
  type SignalInput,
  type SignalInputType,
} from '../../../SignalBase.js';
import {
  openAiModerationDocsUrl,
  openAiModerationEligibleSubcategories,
  openAiModerationGetDisabledInfo,
  openAiModerationIntegration,
  openAiModerationNeedsActionPenalties,
  openAiModerationNeedsMatchingValues,
  openAiModerationPricingStructure,
  openAiModerationRecommendedThresholds,
  openAiModerationSupportedLanguages,
  runOpenAiModerationImageImpl,
  runOpenAiModerationImpl,
  type FetchOpenAiModerationScores,
  type OpenAiImageModelName,
  type OpenAiModelName,
} from './openAIModerationUtils.js';

type SignalRunResult = {
  score: number;
  outputType: { scalarType: ScalarTypes['NUMBER'] };
};

type ModerationMode<InputScalar extends SignalInputType, ModelName> = {
  /** ScalarType key returned by `eligibleInputs` (e.g. `ScalarTypes.IMAGE`). */
  inputScalar: InputScalar;
  /** Routes to either `runOpenAiModerationImpl` or `runOpenAiModerationImageImpl`. */
  runImpl: (
    getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
    input: SignalInput<InputScalar>,
    getOpenAiScores: FetchOpenAiModerationScores,
    modelName: ModelName,
  ) => Promise<SignalRunResult>;
};

type SignalConfig<ModelName> = {
  type: SignalType;
  displayName: string;
  description: string;
  modelName: ModelName;
};

function makeOpenAiModerationSignal<
  InputScalar extends SignalInputType,
  ModelName,
>(config: SignalConfig<ModelName> & ModerationMode<InputScalar, ModelName>) {
  return class OpenAiModerationSignal extends SignalBase<
    InputScalar,
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
      return [config.inputScalar];
    }

    override get outputType() {
      return { scalarType: ScalarTypes.NUMBER };
    }

    // Matches the legacy OpenAI text-signal baseline (`getCost: 20`). Values
    // here are unitless ordering hints used by the rule engine to prefer
    // cheaper signals — they're not calibrated against latency or $ across
    // the codebase. Re-calibrating is tracked separately; perpetuating the
    // existing baseline keeps new signals consistent with their text peers.
    override getCost() {
      return 20;
    }

    override get allowedInAutomatedRules() {
      return true;
    }

    /**
     * Fetches the omni-moderation `${config.modelName}` score for the input
     * and returns it as a number between 0 and 1.
     */
    async run(input: SignalInput<InputScalar>) {
      return config.runImpl(
        this.getOpenAiCredentials,
        input,
        this.getOpenAiScores,
        config.modelName,
      );
    }
  };
}

/**
 * Factory for image-input OpenAI moderation signals. The `modelName`
 * parameter is constrained to {@link OpenAiImageModelName} so callers can't
 * request a category OpenAI only scores against text.
 */
export function makeOpenAiImageModerationSignal(
  config: SignalConfig<OpenAiImageModelName>,
) {
  return makeOpenAiModerationSignal<ScalarTypes['IMAGE'], OpenAiImageModelName>(
    {
      ...config,
      inputScalar: ScalarTypes.IMAGE,
      runImpl: runOpenAiModerationImageImpl,
    },
  );
}

/**
 * Factory for text-input OpenAI moderation signals. Accepts the full
 * {@link OpenAiModelName} since omni-moderation scores every category on
 * text.
 */
export function makeOpenAiTextModerationSignal(
  config: SignalConfig<OpenAiModelName>,
) {
  return makeOpenAiModerationSignal<ScalarTypes['STRING'], OpenAiModelName>({
    ...config,
    inputScalar: ScalarTypes.STRING,
    runImpl: runOpenAiModerationImpl,
  });
}
