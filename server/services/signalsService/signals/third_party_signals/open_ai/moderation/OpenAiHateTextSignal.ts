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

export default class OpenAiHateTextSignal extends SignalBase<
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
    return { type: SignalType.OPEN_AI_HATE_TEXT_MODEL };
  }

  override get displayName() {
    return 'OpenAI Hate Text score';
  }

  override get description() {
    return `OpenAI's model that detects hateful content, which is defined as content that expresses, incites, or promotes hate based on race, gender, ethnicity, religion, nationality, sexual orientation, disability status, or caste.

      This model produces a confidence score between 0 and 1, indicating the model's confidence that the content is hateful. For example, if the model produces a score of 0.76, that means the model is 76% confident that the content in question contains hate.`;
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

  async run(input: SignalInput<ScalarTypes['STRING']>) {
    return runOpenAiModerationImpl(
      this.getOpenAiCredentials,
      input,
      this.getOpenAiScores,
      'hate',
    );
  }
}
