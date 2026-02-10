import { ScalarTypes } from '@roostorg/types';
import * as fuzzball from 'fuzzball';
import _ from 'lodash';
import { normalizeText } from 'normalize-text';

import { Language } from '../../../../../utils/language.js';
import { SignalPricingStructure as SignalPricingStructureType } from '../../../types/SignalPricingStructure.js';
import { SignalType } from '../../../types/SignalType.js';
import SignalBase, { type SignalInput } from '../../SignalBase.js';
import { replaceHomoglyphs } from './textTransform.js';

const { partial_ratio, ratio } = fuzzball;
const { maxBy } = _;

export default class TextSimilarityScoreSignal extends SignalBase<
  ScalarTypes['STRING'],
  { scalarType: ScalarTypes['NUMBER'] }
> {
  override get id() {
    return { type: SignalType.TEXT_SIMILARITY_SCORE };
  }

  override get displayName() {
    return 'Text similarity score';
  }

  override get description() {
    return (
      "Computes the similarity between the content's" +
      ' text and a keyword. If you input multiple keywords, the' +
      ' maximum similarity score of all the keywords will be used.'
    );
  }

  override get outputType() {
    return { scalarType: ScalarTypes.NUMBER };
  }

  override get eligibleInputs() {
    return [ScalarTypes.STRING];
  }

  override get needsMatchingValues() {
    return true as const;
  }

  override async getDisabledInfo() {
    return { disabled: false as const };
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
      Language.LATIN,
      Language.PIDGIN,
      Language.PORTUGUESE,
      Language.SPANISH,
    ];
  }

  /**
   * Estimated cost of hashing text and computing similarity score
   */
  override getCost() {
    return 5;
  }

  override get allowedInAutomatedRules() {
    return true;
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
   * Prepares a string for text similarity matching. First, we normalize
   * the text by removing punctuation and whitespace via the normalize-text
   * npm package. Then, we replace any homoglyphs, which are visually similar
   * characters designed to fool detection (e.g. '$' instead of 'S').
   */
  prepareTextForMatching(text: string) {
    return replaceHomoglyphs(normalizeText(text));
  }

  /**
   * Compute text similarity using fuzzball partial_ratio (open sourced
   * by Seatgeek).
   *
   * Importantly, partial_ratio looks for similarity of substrings. So,
   * if the string extracted from the content is very short (e.g. just
   * the letter 'A'), then it'll have a partial_ratio of 1 when matched
   * to any targetString that contains the letter 'A'.
   *
   * We need to special case the instances where targetString is shorter
   * than matchingString, which will be somewhat rare, but not insanely
   * rare. In that case, we just use levenshtein distance.
   *
   * @param targetString - the string extracted from the content being
   * evaluated by a rule
   * @param matchingString - a string to which we're comparing the targetString.
   * This could be a string in a text bank, or a string manually entered
   * into a condition.
   */
  computeSimilarity(targetString: string, matchingString: string) {
    if (targetString.length < matchingString.length) {
      return (
        ratio(targetString, matchingString, { force_ascii: false }) / 100.0
      );
    }
    return (
      partial_ratio(targetString, matchingString, { force_ascii: false }) /
      100.0
    );
  }

  /**
   * Compute the similarity between a piece of text and all the candidates
   * in matchingValues. Then evaluate it using the comparator and threshold
   * passed in.
   *
   * To determine text similarity, first we normalize both text and matchingValues,
   * using the normalize-text npm module. This strips away excess whitespace, removes
   * unimportant characters, and makes characters uniform and standard (e.g. removes
   * accents).
   *
   * Then, we run the text and matchingValues through replaceHomoglyphs(), which
   * looks for common homoglyph characters (e.g. '$' instead of 's', '3' instead of
   * 'e', '@' instead of 'a', etc.) and replaces them with the more standard character.
   *
   * Then we use Seatgeek's open source string fuzzy matching npm module (fuzzball)
   * to compute similarity scores between the text and the matchingValues. We use
   * partial_ratio() because it allows for substring matching.
   */
  override async run(input: SignalInput<ScalarTypes['STRING'], true>) {
    /**
     * First, normalize the content's text and remove any homoglyphs.
     */
    const preparedText = this.prepareTextForMatching(input.value.value);

    /**
     * Next we need to find two things:
     * (1) the maximum similarity score between the content's text and all
     * the matching string candidates
     * (2) the matching string candidate that produced that maximum score, so
     * we can display it to the user as the 'matchedValue'
     */
    const [maxScore, matchingStringWithMaxSimilarity] = maxBy(
      input.matchingValues.map((originalString) => {
        const similarityScore = this.computeSimilarity(
          preparedText,
          this.prepareTextForMatching(originalString),
        );
        return [similarityScore, originalString] as const;
      }),
      (it) => it[0],
    )!;

    return {
      score: maxScore,
      matchedValue: matchingStringWithMaxSimilarity,
      outputType: { scalarType: ScalarTypes.NUMBER },
    };
  }
}
