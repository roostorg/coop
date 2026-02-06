import { type ScalarTypes } from '@roostorg/types';

import { SignalType } from '../../types/SignalType.js';
import { type SignalInput } from '../SignalBase.js';
import TextRegexMatchingSignalBase from './TextRegexMatchingSignalBase.js';

// TODO: we don't really need TextMatchingContainsRegexSignal and
// TextMatchingNotContainsRegexSignal. Ditto for TextMatchingContainsTextSignal
// and TextMatchingNotContainsTextSignal. Instead, we could just have one signal
// each that returns the number of matches, or a boolean indicating whether
// there were any matches, and then the Condition would do a comparison against
// that number/boolean. To do that approach, though, we'd have to migrate all
// our user's existing rules and have the UI generate those conditions
// automatically if the matches vs. does not match is more intuitive UX-wise.
export default class TextMatchingNotContainsRegexSignal extends TextRegexMatchingSignalBase {
  override get id() {
    return { type: SignalType.TEXT_MATCHING_NOT_CONTAINS_REGEX };
  }

  override get displayName() {
    return 'Does not contain regex';
  }

  override get description() {
    return (
      "Detects whether any regex is present in the content's text. " +
      'You may input multiple regexes, and if a single match is found, this ' +
      'condition fails.'
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
    const containsTextResult = this.matchesRegexStrings(
      input.value.value,
      input.matchingValues,
    );

    return { ...containsTextResult, score: !containsTextResult.score };
  }
}
