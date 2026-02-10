/* eslint-disable max-lines */
import { type ItemIdentifier } from '@roostorg/types';

import type { AggregationsService } from '../../aggregationsService/index.js';
import type { GetPoliciesByIdEventuallyConsistent } from '../../manualReviewToolService/manualReviewToolQueries.js';
import { type UserScore } from '../../userStatisticsService/userStatisticsService.js';
import { type UserStrikeService } from '../../userStrikeService/index.js';
import AggregationSignal from '../signals/aggregation/AggregationSignal.js';
import GeoContainedWithinSignal from '../signals/GeoContainedWithinSignal.js';
import ImageExactMatchSignal from '../signals/ImageExactMatchSignal.js';
import ImageSimilarityScoreSignal from '../signals/ImageSimilarityScoreSignal.js';
import ImageSimilarityDoesNotMatchSignal from '../signals/ImageSimilarityDoesNotMatch.js';
import ImageSimilarityMatchSignal from '../signals/ImageSimilarityMatch.js';
import CoopRiskModelSignal from '../signals/CoopRiskModelSignal.js';
import {
  type SignalBase,
  type SignalInputType,
} from '../signals/SignalBase.js';
import TextMatchingContainsVariantSignal from '../signals/text_matching/fuzzy_matching/TextMatchingContainsVariantSignal.js';
import TextSimilarityScoreSignal from '../signals/text_matching/fuzzy_matching/TextSimilarityScoreSignal.js';
import TextMatchingContainsRegexSignal from '../signals/text_matching/TextMatchingContainsRegexSignal.js';
import TextMatchingContainsTextSignal from '../signals/text_matching/TextMatchingContainsTextSignal.js';
import TextMatchingNotContainsRegexSignal from '../signals/text_matching/TextMatchingNotContainsRegexSignal.js';
import TextMatchingNotContainsTextSignal from '../signals/text_matching/TextMatchingNotContainsTextSignal.js';
import GoogleContentSafetyImageSignal from '../signals/third_party_signals/google/content_safety/GoogleContentSafetyImageSignal.js';
import GoogleCloudTranslationAPISignal from '../signals/third_party_signals/google/GoogleCloudTranslationAPISignal.js';
import OpenAiGraphicViolenceTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiGraphicViolenceTextSignal.js';
import OpenAiHateTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiHateTextSignal.js';
import OpenAiHateThreateningTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiHateThreateningTextSignal.js';
import OpenAiSelfHarmTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiSelfHarmTextSignal.js';
import OpenAiSexualMinorsTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiSexualMinorsTextSignal.js';
import OpenAiSexualTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiSexualTextSignal.js';
import OpenAiViolenceTextSignal from '../signals/third_party_signals/open_ai/moderation/OpenAiViolenceTextSignal.js';
import OpenAiWhisperTranscriptionSignal from '../signals/third_party_signals/open_ai/whisper/OpenAiWhisperTranscriptionSignal.js';
import UserScoreSignal from '../signals/UserScoreSignal.js';
import UserStrikesSignal from '../signals/UserStrikesSignal.js';
import { SignalType, type BuiltInSignalType } from '../types/SignalType.js';
import { type CredentialGetters } from './makeCachedCredentialsGetters.js';
import { type CachedFetchers } from './makeCachedFetchers.js';
import type { HmaService } from '../../hmaService/index.js';

export function instantiateBuiltInSignals(
  credentialGetters: CredentialGetters,
  cachedFetchers: CachedFetchers,
  getUserScoreEventuallyConsistent: (
    orgId: string,
    userItemIdentifier: ItemIdentifier,
  ) => Promise<UserScore>,
  aggregationsService: AggregationsService,
  userStrikeService: UserStrikeService,
  _getPoliciesByIdEventuallyConsistent: GetPoliciesByIdEventuallyConsistent,
  hmaService: HmaService,
) {
  const {
    googleContentSafetyFetcher: getGoogleContentSafetyScores,
    openAiModerationFetcher: getOpenAiScores,
    openAiWhisperTranscriptionFetcher: getOpenAiTranscription,
  } = cachedFetchers;

  return {
    [SignalType.TEXT_MATCHING_CONTAINS_TEXT]:
      new TextMatchingContainsTextSignal(),
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_TEXT]:
      new TextMatchingNotContainsTextSignal(),
    [SignalType.TEXT_MATCHING_CONTAINS_REGEX]:
      new TextMatchingContainsRegexSignal(),
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_REGEX]:
      new TextMatchingNotContainsRegexSignal(),
    [SignalType.TEXT_MATCHING_CONTAINS_VARIANT]:
      new TextMatchingContainsVariantSignal(),
    [SignalType.TEXT_SIMILARITY_SCORE]: new TextSimilarityScoreSignal(),
    [SignalType.IMAGE_EXACT_MATCH]: new ImageExactMatchSignal(),
    [SignalType.IMAGE_SIMILARITY_SCORE]: new ImageSimilarityScoreSignal(),
    [SignalType.IMAGE_SIMILARITY_DOES_NOT_MATCH]: new ImageSimilarityDoesNotMatchSignal(
      hmaService,
    ),
    [SignalType.IMAGE_SIMILARITY_MATCH]: new ImageSimilarityMatchSignal(
      hmaService,
    ),
    [SignalType.GOOGLE_CONTENT_SAFETY_API_IMAGE]:
      new GoogleContentSafetyImageSignal(
        credentialGetters.GOOGLE_CONTENT_SAFETY_API,
        getGoogleContentSafetyScores,
      ),
    [SignalType.OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL]:
      new OpenAiGraphicViolenceTextSignal(
        credentialGetters.OPEN_AI,
        getOpenAiScores,
      ),
    [SignalType.OPEN_AI_HATE_TEXT_MODEL]: new OpenAiHateTextSignal(
      credentialGetters.OPEN_AI,
      getOpenAiScores,
    ),
    [SignalType.OPEN_AI_HATE_THREATENING_TEXT_MODEL]:
      new OpenAiHateThreateningTextSignal(
        credentialGetters.OPEN_AI,
        getOpenAiScores,
      ),
    [SignalType.OPEN_AI_SELF_HARM_TEXT_MODEL]: new OpenAiSelfHarmTextSignal(
      credentialGetters.OPEN_AI,
      getOpenAiScores,
    ),
    [SignalType.OPEN_AI_SEXUAL_MINORS_TEXT_MODEL]:
      new OpenAiSexualMinorsTextSignal(
        credentialGetters.OPEN_AI,
        getOpenAiScores,
      ),
    [SignalType.OPEN_AI_SEXUAL_TEXT_MODEL]: new OpenAiSexualTextSignal(
      credentialGetters.OPEN_AI,
      getOpenAiScores,
    ),
    [SignalType.OPEN_AI_VIOLENCE_TEXT_MODEL]: new OpenAiViolenceTextSignal(
      credentialGetters.OPEN_AI,
      getOpenAiScores,
    ),
    [SignalType.OPEN_AI_WHISPER_TRANSCRIPTION]:
      new OpenAiWhisperTranscriptionSignal(
        credentialGetters.OPEN_AI,
        getOpenAiTranscription,
      ),
    [SignalType.GEO_CONTAINED_WITHIN]: new GeoContainedWithinSignal(),
    [SignalType.USER_STRIKE_VALUE]: new UserStrikesSignal(userStrikeService),
    [SignalType.USER_SCORE]: new UserScoreSignal(
      getUserScoreEventuallyConsistent,
    ),
    [SignalType.GOOGLE_CLOUD_TRANSLATE_MODEL]:
      new GoogleCloudTranslationAPISignal(),
    [SignalType.BENIGN_MODEL]: new CoopRiskModelSignal(),
    [SignalType.AGGREGATION]: new AggregationSignal(aggregationsService),
    // Satisfies check to make sure we didn't forget any signals.
  } satisfies { [K in BuiltInSignalType]: SignalBase<SignalInputType> };
}
