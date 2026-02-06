import { type ScalarTypes } from '@roostorg/types';

import { SignalType } from '../../types/SignalType.js';
import { type SignalInput } from '../SignalBase.js';
import TextExactMatchingSignalBase from './TextExactMatchingSignalBase.js';

export default class TextMatchingNotContainsTextSignal extends TextExactMatchingSignalBase {
  override get id() {
    return { type: SignalType.TEXT_MATCHING_NOT_CONTAINS_TEXT };
  }

  override get displayName() {
    return 'Does not contain text';
  }

  override get description() {
    return (
      "Detects whether any keyword is present in the content's text. " +
      'You may input multiple keywords, and if a single keyword match is found, ' +
      'this condition will fail.'
    );
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

  override async run(input: SignalInput<ScalarTypes['STRING'], true>) {
    const containsTextResult = this.containsMatchingText(
      input.value.value,
      input.matchingValues,
    );

    return { ...containsTextResult, score: !containsTextResult.score };
  }
}
