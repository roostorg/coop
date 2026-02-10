import { ScalarTypes } from '@roostorg/types';

import { type Language } from '../../../../utils/language.js';
import { type NonEmptyArray } from '../../../../utils/typescript-types.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../../types/SignalPricingStructure.js';
import SignalBase from '../SignalBase.js';

export default abstract class TextExactMatchingSignalBase extends SignalBase<
  ScalarTypes['STRING'] | ScalarTypes['ID'],
  { scalarType: ScalarTypes['BOOLEAN'] }
> {
  override get eligibleInputs() {
    return [ScalarTypes.STRING, ScalarTypes.ID];
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  override get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get needsMatchingValues() {
    return true as const;
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
  }

  override get supportedLanguages(): Language[] | 'ALL' {
    return 'ALL';
  }

  containsMatchingText(text: string, matchingValues: NonEmptyArray<string>) {
    const textLower = text.toLowerCase();
    const matchedValue = matchingValues.find((value) =>
      textLower.includes(value.toLowerCase()),
    );

    return matchedValue !== undefined
      ? {
          score: true,
          matchedValue,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
        }
      : {
          score: false,
          outputType: { scalarType: ScalarTypes.BOOLEAN },
        };
  }

  /**
   * Exact text matching has negligible cost
   */
  override getCost() {
    return 0;
  }

  override get allowedInAutomatedRules() {
    return true;
  }
}
