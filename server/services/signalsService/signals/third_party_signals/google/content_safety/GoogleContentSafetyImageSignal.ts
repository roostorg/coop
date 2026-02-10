import { ScalarTypes } from '@roostorg/types';

import { type CachedGetCredentials } from '../../../../../signalAuthService/signalAuthService.js';
import { Integration } from '../../../../types/Integration.js';
import { type RecommendedThresholds } from '../../../../types/RecommendedThresholds.js';
import { SignalPricingStructure } from '../../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../../SignalBase.js';
import {
  GOOGLE_CONTENT_SAFETY_PRIORITIES,
  runGoogleContentSafetyImageImpl,
  type FetchGoogleContentSafetyScores,
} from './googleContentSafetyLib.js';

export default class GoogleContentSafetyImageSignal extends SignalBase<
  ScalarTypes['IMAGE'],
  {
    scalarType: ScalarTypes['STRING'];
    enum: typeof GOOGLE_CONTENT_SAFETY_PRIORITIES;
    ordered: true;
  }
> {
  constructor(
    protected readonly getGoogleContentSafetyCredentials: CachedGetCredentials<'GOOGLE_CONTENT_SAFETY_API'>,
    protected readonly getGoogleContentSafetyScores: FetchGoogleContentSafetyScores,
  ) {
    super();
  }

  override get id() {
    return { type: SignalType.GOOGLE_CONTENT_SAFETY_API_IMAGE };
  }

  override get displayName() {
    return 'Google Content Safety API - Image';
  }

  override get description() {
    return `Google's Content Safety API uses AI to classify and prioritize files for child safety manual review. The API returns a priority value (VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH) indicating the likelihood that the image is abusive.`;
  }

  override get docsUrl() {
    return 'https://protectingchildren.google/tools-for-partners/';
  }

  override get integration() {
    return Integration.GOOGLE_CONTENT_SAFETY_API;
  }

  override get pricingStructure() {
    return SignalPricingStructure.FREE;
  }

  override get recommendedThresholds(): RecommendedThresholds | null {
    return {
      highPrecisionThreshold: 'VERY_HIGH',
      highRecallThreshold: 'MEDIUM',
    };
  }

  override get supportedLanguages(): 'ALL' {
    return 'ALL';
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get needsMatchingValues() {
    return false;
  }

  override async getDisabledInfo(orgId: string) {
    const credential = await this.getGoogleContentSafetyCredentials(orgId);
    // eslint-disable-next-line security/detect-possible-timing-attacks
    return !credential?.apiKey
      ? {
          disabled: true as const,
          disabledMessage: `You need to input your Google Content Safety API key to use Google's signals`,
        }
      : { disabled: false as const };
  }

  override get eligibleInputs() {
    return [ScalarTypes.IMAGE];
  }

  override get outputType() {
    return {
      scalarType: ScalarTypes.STRING,
      enum: GOOGLE_CONTENT_SAFETY_PRIORITIES,
      ordered: true as const,
    };
  }

  /**
   * Placeholder estimate - Google Content Safety API is free for qualifying partners
   */
  override getCost() {
    return 0;
  }

  /**
   * Google Content Safety API is designed for routing/prioritization only.
   * It provides priority levels for manual review, not automated decisions.
   */
  override get allowedInAutomatedRules() {
    return false;
  }

  async run(input: SignalInput<ScalarTypes['IMAGE']>) {
    return runGoogleContentSafetyImageImpl(
      this.getGoogleContentSafetyCredentials,
      input,
      this.getGoogleContentSafetyScores,
    );
  }
}
