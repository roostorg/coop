import { ScalarTypes } from '@roostorg/types';

import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
} from './SignalBase.js';

export default class ImageExactMatchSignal extends SignalBase<
  ScalarTypes['IMAGE'],
  { scalarType: ScalarTypes['BOOLEAN'] }
> {
  override get id() {
    return { type: SignalType.IMAGE_EXACT_MATCH };
  }

  override get displayName() {
    return 'Contains image';
  }

  override get description() {
    return (
      'Detects whether any predefined images' +
      "exactly match any of the content's images"
    );
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override async getDisabledInfo(_: unknown): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Support for image comparison signals is coming soon!',
    };
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  override get eligibleInputs() {
    return [ScalarTypes.IMAGE];
  }

  override get needsMatchingValues() {
    return true;
  }

  override getCost() {
    return 10;
  }

  override get allowedInAutomatedRules() {
    return true;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get needsActionPenalties() {
    return false;
  }

  override get integration() {
    return null;
  }

  override get docsUrl() {
    return null;
  }

  override get eligibleSubcategories() {
    return [];
  }

  async run(_input: SignalInput<ScalarTypes['IMAGE']>): Promise<never> {
    throw new Error('not implemented');
  }
}
