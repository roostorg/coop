import { v2 } from '@google-cloud/translate';
import { ScalarTypes, type ScalarTypeRuntimeType } from '@roostorg/types';

import { SignalPricingStructure } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
  type SignalResult,
} from '../../SignalBase.js';

const translator = new v2.Translate({
  key: String(process.env.GOOGLE_TRANSLATE_API_KEY),
});

export default class GoogleCloudTranslationAPISignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['STRING'] },
  ScalarTypeRuntimeType<ScalarTypes['STRING']>,
  'GOOGLE_CLOUD_TRANSLATE_MODEL'
> {
  override get id() {
    return { type: SignalType.GOOGLE_CLOUD_TRANSLATE_MODEL };
  }

  override get displayName() {
    return 'Google English Translation';
  }

  override async getDisabledInfo(_orgId: string): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Support for Google Translation API is coming soon!',
    };
  }

  override get needsMatchingValues() {
    return false;
  }

  override get docsUrl() {
    return 'https://cloud.google.com/translate/docs';
  }

  override get pricingStructure() {
    return SignalPricingStructure.SUBSCRIPTION;
  }

  override get description() {
    return 'Translates the input to English using Google Translate.';
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get recommendedThresholds() {
    return null;
  }

  // TODO: add enum case for this
  override get integration() {
    return null;
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.STRING };
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  // See comment on HiveAudioTranscriptionSignal.getCost, similar concern
  override getCost() {
    return 20;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  override async run(
    input: SignalInput<ScalarTypes['STRING']>,
  ): Promise<SignalResult<{ scalarType: ScalarTypes['STRING'] }>> {
    const translation = await translator.translate(input.value.value, 'en');
    return {
      outputType: { scalarType: ScalarTypes.STRING },
      score: String(translation),
    };
  }
}
