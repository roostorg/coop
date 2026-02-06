import { ScalarTypes } from '@roostorg/types';
import { normalizeText } from 'normalize-text';
import SizeLimitedMap from 'size-limited-map';

import { regexEscape, runEncode } from '../../../../../utils/encoding.js';
import { Language } from '../../../../../utils/language.js';
import { SignalType } from '../../../types/SignalType.js';
import { type SignalInput } from '../../SignalBase.js';
import TextRegexMatchingSignalBase from '../TextRegexMatchingSignalBase.js';
import { replaceHomoglyphs } from './textTransform.js';

export default class TextMatchingContainsVariantSignal extends TextRegexMatchingSignalBase {
  override get id() {
    return { type: SignalType.TEXT_MATCHING_CONTAINS_VARIANT };
  }

  override get displayName() {
    return 'Text contains variant';
  }

  override get description() {
    return (
      'Intended to be used with short strings, attempt to replace all known homoglyphs ($ = s)' +
      ' with their more common variants, and detect whether any substring exists in the input,' +
      ' guarding against repeating letters (test matches with ttesssttt)'
    );
  }

  override get outputType() {
    return { scalarType: ScalarTypes.BOOLEAN };
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get needsMatchingValues() {
    return true as const;
  }

  override get supportedLanguages(): Language[] | 'ALL' {
    return [
      Language.ENGLISH,
      Language.FRENCH,
      Language.GERMAN,
      Language.ITALIAN,
      Language.LATIN,
      Language.PIDGIN,
      Language.PORTUGUESE,
      Language.SPANISH,
    ];
  }

  /**
   * Estimated cost of transforming and executing regex is negligible
   */
  override getCost() {
    return 1;
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

  /**
   * Compute the similarity between a piece of text and all the candidates in
   * matchingValues. Then evaluate it using the comparator and threshold
   * passed in.
   *
   * To determine text similarity, first we normalize both text and
   * matchingValues, using the normalize-text npm module. This strips away
   * excess whitespace, removes unimportant characters, and makes characters
   * uniform and standard (e.g. removes accents).
   *
   * Then, we run the text and matchingValues through replaceHomoglyphs(), which
   * looks for common homoglyph characters (e.g. '$' instead of 's', '3' instead
   * of 'e', '@' instead of 'a', etc.) and replaces them with the more standard
   * character.
   *
   * We construct a regex out of the normalized/homoglyphed input texts so that
   * we can detect repeating letters (e.g. test will match on ttesssttt, but
   * mirror won't match miror etc.). This slightly breaks for the lower case
   * letter 'm' which gets deconstructed into 'rn' with unhomoglyph, along with
   * a handful of other special characters which become multiple letters.
   *
   * TODOs if necessary:
   * - Get ahead of unhomoglyph on certain characters (⒜ -> (a) instead of a
   *   which is almost certainly what we want)
   * - Fix the lowercase m weakness
   * - Add Emoji support since unhomoglyph doesn't support it.
   */
  override async run(input: SignalInput<ScalarTypes['STRING'], true>) {
    // First, normalize the content's text and remove any homoglyphs.
    const preparedText = prepareTextForMatching(input.value.value);

    const idxOfMatchingMatchingValue = input.matchingValues
      .map((it) => matchingValueToVariantRegexWithCache(it))
      .findIndex((it) => it.test(preparedText));

    const foundMatchingVariant = idxOfMatchingMatchingValue !== -1;

    return {
      score: foundMatchingVariant,
      // If there was a match, find the original string so we can show the
      // user the appropriate matched string.
      matchedValue: foundMatchingVariant
        ? input.matchingValues[idxOfMatchingMatchingValue]
        : undefined,
      outputType: this.outputType,
    };
  }
}

/**
 * Prepares a string for text similarity matching. First, we normalize
 * the text by removing punctuation and whitespace via the normalize-text
 * npm package. Then, we replace any homoglyphs, which are visually similar
 * characters designed to fool detection (e.g. '$' instead of 'S').
 */
function prepareTextForMatching(text: string) {
  return replaceHomoglyphs(normalizeText(text));
}

/**
 * Constructs a regex that matches any string which, at the beginning of a word
 * (i.e., after a space or at the beginning of the string), contains all the
 * characters in the same order and at least as many times as in the input
 * `text`, comparing case-insensitively.
 */
function constructRegex(text: string) {
  // eslint-disable-next-line security/detect-non-literal-regexp
  return new RegExp(
    '(^|\\s)' +
      runEncode(text)
        .map(([char, count]) => regexEscape(char) + '{' + String(count) + ',}')
        .join(''),
    'i',
  );
}

function matchingValueToVariantRegex(valueToMatch: string) {
  return constructRegex(prepareTextForMatching(valueToMatch));
}

/**
 * This function matches the behavior of {@link matchingValueToVariantRegex},
 * except that it uses a cache to record the most recent 10,000 input strings,
 * to avoid constructing the variant regexes for the same strings over and over.
 *
 * The basic rationale here is that our users have a fixed, and small,
 * number of strings for which they're checking for variants. However, the
 * _number of times_ that we use one of these strings to check an incoming piece
 * of content is O(n) in the number of submissions. Given that we have ~100
 * million submisssions/day, each day were were constructing each regex roughly
 * ~100 million times, when we really only needed to do it once. This was
 * stupid, but doubly so because normalizing the matching value and constructing
 * the RegExp is actually quite expensive (and constructing it over and over may
 * prevent the JS engine from optimizing the `.test()` call against it).
 *
 * The result was that, at one point, a full 20% of our CPU usage(!!) was going
 * toward constructing these regexes. This should bring that usage down to
 * roughly 0, at the cost of very minimal memory (10k cached values * ~100 bytes
 * per value = 1Mb). Even if that memory estimate is off by an order of
 * magnitude from various data structure overhead, the memory is negligble.
 *
 * Note that we don't use the built-in caching helpers because:
 *
 * 1) SizeLimitedMap isn't integrated with those helpers (for now);
 * 2) all of those helpers create resources that require shutdown (e.g., a
 *    NodeJS.Timer to evict old items from the cache), and I didn't want to have
 *    to add shutdown logic to the signal execution service.
 */
const matchingValueToVariantRegexWithCache = (() => {
  const cache = new SizeLimitedMap<string, RegExp>(10_000);
  return (matchingValue: string) => {
    if (cache.has(matchingValue)) {
      return cache.get(matchingValue)!;
    } else {
      const newValue = matchingValueToVariantRegex(matchingValue);
      cache.set(matchingValue, newValue);
      return newValue;
    }
  };
})();
