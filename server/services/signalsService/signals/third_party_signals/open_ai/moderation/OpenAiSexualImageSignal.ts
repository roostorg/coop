import { ScalarTypes } from '@roostorg/types';

import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { SignalType } from '../../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../../SignalBase.js';
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
  type FetchOpenAiModerationScores,
} from './openAIModerationUtils.js';

/**
 * OpenAI image-moderation signal scoring whether an image is meant to arouse
 * sexual excitement or depicts sexual activity (excluding sex education and
 * wellness content). Routes through omni-moderation-latest's multimodal
 * endpoint and returns the `sexual` category score (0..1).
 */
export default class OpenAiSexualImageSignal extends SignalBase<
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
    return { type: SignalType.OPEN_AI_SEXUAL_IMAGE_MODEL };
  }

  override get displayName() {
    return 'OpenAI Sexual Image score';
  }

  override get description() {
    return `OpenAI's model that detects sexual content, which is defined as content meant to arouse sexual excitement, such as the description of sexual activity, or that promotes sexual services (excluding sex education and wellness). Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image is sexual.`;
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

  /**
   * Placeholder estimate
   */
  override getCost() {
    return 20;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  /**
   * Fetches the omni-moderation `sexual` score for the image and returns it
   * as a number between 0 and 1.
   */
  async run(input: SignalInput<ScalarTypes['IMAGE']>) {
    return runOpenAiModerationImageImpl(
      this.getOpenAiCredentials,
      input,
      this.getOpenAiScores,
      'sexual',
    );
  }
}
