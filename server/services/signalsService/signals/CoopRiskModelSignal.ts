import { ScalarTypes } from '@roostorg/types';

import { Language } from '../../../utils/language.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
} from './SignalBase.js';

export default class CoopRiskModelSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  get docsUrl() {
    return null;
  }

  get eligibleSubcategories() {
    return [];
  }

  override get integration() {
    return null;
  }

  get recommendedThresholds() {
    return {
      highPrecisionThreshold: '0.95',
      highRecallThreshold: '0.8',
    };
  }

  get needsMatchingValues() {
    return false;
  }

  override get id() {
    return { type: SignalType.BENIGN_MODEL };
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get outputType() {
    return {
      scalarType: ScalarTypes.NUMBER,
    };
  }

  override get displayName() {
    return 'Coop Harassment AI Model';
  }

  override async getDisabledInfo(_orgId: string): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Please contact Coop to try our new Coop AI product!',
    };
  }

  override get description() {
    return 'Your custom Coop Harassment AI model, trained on your data, your Harassment policy, and your labeled examples.';
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get supportedLanguages(): Language[] | 'ALL' {
    return [
      Language.ENGLISH,
      Language.FRENCH,
      Language.GERMAN,
      Language.ITALIAN,
      Language.PORTUGUESE,
      Language.RUSSIAN,
      Language.SPANISH,
      Language.HINDI,
      Language.KOREAN,
      Language.POLISH,
      Language.PORTUGUESE,
      Language.ARABIC,
      Language.CHINESE,
      Language.CZECH,
      Language.DUTCH,
      Language.INDONESIAN,
      Language.JAPANESE,
    ];
  }

  override getCost() {
    return 15;
  }

  override get needsActionPenalties() {
    return false as const;
  }

  override async run(_input: SignalInput<ScalarTypes['STRING']>) {
    return {
      score: 0.5,
      outputType: { scalarType: ScalarTypes.NUMBER },
    };
  }
}
