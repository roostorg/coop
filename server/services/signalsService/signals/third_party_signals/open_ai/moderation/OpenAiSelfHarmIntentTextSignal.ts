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
  runOpenAiModerationImpl,
  type FetchOpenAiModerationScores,
} from './openAIModerationUtils.js';

/**
 * OpenAI text-moderation signal scoring whether text expresses the speaker's
 * intent to engage in acts of self-harm (suicide, cutting, eating disorders,
 * etc.). Routes through omni-moderation-latest and returns the
 * `self-harm/intent` category score (0..1).
 */
export default class OpenAiSelfHarmIntentTextSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  constructor(
    protected readonly getOpenAiCredentials: CachedGetCredentials<'OPEN_AI'>,
    protected readonly getOpenAiScores: FetchOpenAiModerationScores,
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.OPEN_AI_SELF_HARM_INTENT_TEXT_MODEL };
  }

  override get displayName() {
    return 'OpenAI Self-Harm Intent Text score';
  }

  override get description() {
    return `OpenAI's model that detects self-harm intent, which is defined as content where the speaker expresses that they are engaging or intend to engage in acts of self-harm, such as suicide, cutting, and eating disorders.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the content expresses self-harm intent.`;
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
    return [ScalarTypes.STRING];
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
   * Fetches the omni-moderation `self-harm/intent` score for the text and
   * returns it as a number between 0 and 1.
   */
  async run(input: SignalInput<ScalarTypes['STRING']>) {
    return runOpenAiModerationImpl(
      this.getOpenAiCredentials,
      input,
      this.getOpenAiScores,
      'self-harm/intent',
    );
  }
}
