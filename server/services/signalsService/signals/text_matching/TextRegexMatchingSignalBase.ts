import { ScalarTypes } from '@roostorg/types';
import SizeLimitedMap from 'size-limited-map';

import { type Language } from '../../../../utils/language.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../../types/SignalPricingStructure.js';
import SignalBase from '../SignalBase.js';

export default abstract class TextRegexMatchingSignalBase extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['BOOLEAN'] },
  ScalarTypes['STRING']
> {
  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get needsMatchingValues() {
    return true as const;
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  override get pricingStructure(): SignalPricingStructureType {
    return SignalPricingStructureType.FREE;
  }

  override get supportedLanguages(): Language[] | 'ALL' {
    return 'ALL';
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
  }

  matchesRegexStrings(text: string, regexStrings: string[]) {
    // TODO: we might want to have some validation here on the regex string,
    // because, in theory, a poorly or maliciously crafted regex here could
    // contribute to DDOSing the node server (ReDoS attack). For now, though,
    // this is relatively low-risk.
    const matchedValue = regexStrings.find((regexString) =>
      regexStringToRegexWithCache(regexString).test(text),
    );

    return matchedValue !== undefined
      ? { score: true, matchedValue, outputType: this.outputType }
      : { score: false, outputType: this.outputType };
  }

  /**
   * Regex matching has negligible cost
   */
  override getCost() {
    return 0;
  }
}

/**
 * See rationale for the analogous matchingValueToVariantRegexWithCache in
 * TextMatchingContainsVariantSignal.ts.
 */
const regexStringToRegexWithCache = (() => {
  const cache = new SizeLimitedMap<string, RegExp>(10_000);
  return (regexString: string) => {
    if (cache.has(regexString)) {
      return cache.get(regexString)!;
    } else {
      // TODO: we might want to have some validation here on the regex string,
      // because, in theory, a poorly or maliciously crafted regex here could
      // contribute to DDOSing the node server (ReDoS attack). For now, though,
      // this is relatively low-risk as this function is only used here on
      // user-provided strings.
      // eslint-disable-next-line security/detect-non-literal-regexp
      const newValue = new RegExp(regexString, 'i');
      cache.set(regexString, newValue);
      return newValue;
    }
  };
})();
