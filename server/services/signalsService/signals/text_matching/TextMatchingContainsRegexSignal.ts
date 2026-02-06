import { type ScalarTypes } from '@roostorg/types';

import { SignalType } from '../../types/SignalType.js';
import { type SignalInput } from '../SignalBase.js';
import TextRegexMatchingSignalBase from './TextRegexMatchingSignalBase.js';

export default class TextMatchingContainsRegexSignal extends TextRegexMatchingSignalBase {
  override get id() {
    return { type: SignalType.TEXT_MATCHING_CONTAINS_REGEX };
  }

  override get displayName() {
    return 'Contains regex';
  }

  override get description() {
    return (
      "Detects whether any regex is present in the content's text. " +
      'You may input multiple regexes, and this condition will be true if any ' +
      "single regex matches the content's text."
    );
  }

  override async run(input: SignalInput<ScalarTypes['STRING'], true>) {
    return this.matchesRegexStrings(input.value.value, input.matchingValues);
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
}
