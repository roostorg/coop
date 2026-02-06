import { ScalarTypes } from '@roostorg/types';

import { SignalPricingStructure as SignalPricingStructureType } from '../types/SignalPricingStructure.js';
import { SignalType } from '../types/SignalType.js';
import SignalBase, {
  type SignalDisabledInfo,
  type SignalInput,
} from './SignalBase.js';

export default class ImageSimilarityScoreSignal extends SignalBase<
  ScalarTypes['IMAGE'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  override get id() {
    return { type: SignalType.IMAGE_SIMILARITY_SCORE };
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  override get displayName() {
    return 'Image similarity score';
  }

  override get supportedLanguages() {
    return 'ALL' as const;
  }

  get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get description() {
    return (
      "Computes the similarity between the content's" +
      ' images and a predefined image. If the content has multiple' +
      ' images, the maximum similarity score of all the images' +
      ' will be used.'
    );
  }

  override async getDisabledInfo(_: unknown): Promise<SignalDisabledInfo> {
    return {
      disabled: true,
      disabledMessage: 'Support for image comparison signals is coming soon!',
    };
  }

  override get eligibleInputs() {
    return [ScalarTypes.IMAGE];
  }

  override get needsMatchingValues() {
    return true;
  }

  /**
   * Estimated cost of hashing image and computing similarity score
   */
  override getCost() {
    return 10;
  }

  override get eligibleSubcategories() {
    return [];
  }

  override get needsActionPenalties() {
    return false;
  }

  override get docsUrl() {
    return null;
  }

  override get recommendedThresholds() {
    return null;
  }

  override get integration() {
    return null;
  }

  override async run(
    _input: SignalInput<ScalarTypes['IMAGE']>,
  ): Promise<never> {
    throw new Error('not implemented');
  }
}
