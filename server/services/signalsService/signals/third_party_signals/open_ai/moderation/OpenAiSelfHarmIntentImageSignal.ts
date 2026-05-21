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
 * OpenAI image-moderation signal scoring whether an image expresses the
 * speaker's intent to engage in acts of self-harm. Routes through
 * omni-moderation-latest's multimodal endpoint and returns the
 * `self-harm/intent` category score (0..1).
 */
export default class OpenAiSelfHarmIntentImageSignal extends SignalBase<
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
    return { type: SignalType.OPEN_AI_SELF_HARM_INTENT_IMAGE_MODEL };
  }

  override get displayName() {
    return 'OpenAI Self-Harm Intent Image score';
  }

  override get description() {
    return `OpenAI's model that detects self-harm intent, which is defined as content where the speaker expresses that they are engaging or intend to engage in acts of self-harm, such as suicide, cutting, and eating disorders. Scored against the image.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the image expresses self-harm intent.`;
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
   * Fetches the omni-moderation `self-harm/intent` score for the image and
   * returns it as a number between 0 and 1.
   */
  async run(input: SignalInput<ScalarTypes['IMAGE']>) {
    return runOpenAiModerationImageImpl(
      this.getOpenAiCredentials,
      input,
      this.getOpenAiScores,
      'self-harm/intent',
    );
  }
}
