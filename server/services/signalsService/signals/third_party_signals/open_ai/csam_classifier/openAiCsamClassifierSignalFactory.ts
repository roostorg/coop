/**
 * Factory for OpenAI Novel CSAM Classifier signals. Mirrors
 * `openAiModerationSignalFactory` so the per-category signal classes stay
 * one-liners; the classifier is image-only, so there is a single factory.
 *
 * The IoC container instantiates the returned class with
 * `(credentials, scores)` like any other signal, preserving the existing
 * registration pattern in `instantiateBuiltInSignals.ts`.
 */
import { ScalarTypes } from '@roostorg/coop-types';

import { type GetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { type SignalType } from '../../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../../SignalBase.js';
import {
  openAiCsamClassifierDocsUrl,
  openAiCsamClassifierEligibleSubcategories,
  openAiCsamClassifierGetDisabledInfo,
  openAiCsamClassifierIntegration,
  openAiCsamClassifierNeedsActionPenalties,
  openAiCsamClassifierNeedsMatchingValues,
  openAiCsamClassifierPricingStructure,
  openAiCsamClassifierRecommendedThresholds,
  openAiCsamClassifierSupportedLanguages,
  runOpenAiCsamClassifierImageImpl,
  type FetchOpenAiCsamClassifierScores,
  type OpenAiCsamCategory,
} from './openAiCsamClassifierUtils.js';

type SignalConfig = {
  type: SignalType;
  displayName: string;
  description: string;
  category: OpenAiCsamCategory;
};

export function makeOpenAiCsamClassifierImageSignal(config: SignalConfig) {
  return class OpenAiCsamClassifierImageSignal extends SignalBase<
    ScalarTypes['IMAGE'],
    { scalarType: ScalarTypes['NUMBER'] }
  > {
    constructor(
      protected readonly getOpenAiCredentials: GetCredentials<'OPEN_AI'>,
      protected readonly getOpenAiCsamClassifierScores: FetchOpenAiCsamClassifierScores,
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
      return openAiCsamClassifierDocsUrl();
    }

    override get integration() {
      return openAiCsamClassifierIntegration();
    }

    override get pricingStructure() {
      return openAiCsamClassifierPricingStructure();
    }

    override get recommendedThresholds() {
      return openAiCsamClassifierRecommendedThresholds(config.category);
    }

    override get supportedLanguages() {
      return openAiCsamClassifierSupportedLanguages();
    }

    override get eligibleSubcategories() {
      return openAiCsamClassifierEligibleSubcategories();
    }

    override get needsActionPenalties() {
      return openAiCsamClassifierNeedsActionPenalties();
    }

    override get needsMatchingValues() {
      return openAiCsamClassifierNeedsMatchingValues();
    }

    override async getDisabledInfo(orgId: string) {
      return openAiCsamClassifierGetDisabledInfo(
        orgId,
        this.getOpenAiCredentials,
      );
    }

    override get eligibleInputs() {
      return [ScalarTypes.IMAGE];
    }

    override get outputType() {
      return { scalarType: ScalarTypes.NUMBER };
    }

    // Matches the OpenAI moderation signals' baseline ordering hint.
    override getCost() {
      return 20;
    }

    /**
     * CSAM classification scores are for routing and review prioritization
     * (and, where applicable, NCMEC reporting workflows), not automated
     * enforcement decisions.
     */
    override get allowedInAutomatedRules() {
      return false;
    }

    /**
     * Fetches the CSAM Classifier `${config.category}` score for the input
     * image and returns it as a number between 0 and 1.
     */
    async run(input: SignalInput<ScalarTypes['IMAGE']>) {
      return runOpenAiCsamClassifierImageImpl(
        this.getOpenAiCredentials,
        input,
        this.getOpenAiCsamClassifierScores,
        config.category,
      );
    }
  };
}
