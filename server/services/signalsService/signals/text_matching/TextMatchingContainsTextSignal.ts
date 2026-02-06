import { type ScalarTypes } from '@roostorg/types';

import { SignalType } from '../../types/SignalType.js';
import { type SignalInput } from '../SignalBase.js';
import TextExactMatchingSignalBase from './TextExactMatchingSignalBase.js';

export default class TextMatchingContainsTextSignal extends TextExactMatchingSignalBase {
  override get id() {
    return { type: SignalType.TEXT_MATCHING_CONTAINS_TEXT };
  }

  override get displayName() {
    return 'Contains text';
  }

  override get description() {
    return (
      "Detects whether any keyword is present in the content's text. " +
      'You may input multiple keywords, and this condition will be true if any ' +
      'single keyword is found.'
    );
  }

  override async run(input: SignalInput<ScalarTypes['STRING'], true>) {
    return this.containsMatchingText(input.value.value, input.matchingValues);
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
