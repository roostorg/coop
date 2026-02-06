import { type Satisfies } from '../../../utils/typescript-types.js';
import type {
  AggregationClause,
  AggregationRuntimeArgsForItem,
} from '../../aggregationsService/index.js';
import { type SignalType } from './SignalType.js';

export type SignalArgsByType = Satisfies<
  {
    [SignalType.AGGREGATION]: { aggregationClause: AggregationClause };
    [SignalType.GOOGLE_CLOUD_TRANSLATE_MODEL]: undefined;
    [SignalType.OPEN_AI_WHISPER_TRANSCRIPTION]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_TEXT]: undefined;
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_TEXT]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_REGEX]: undefined;
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_REGEX]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_VARIANT]: undefined;
    [SignalType.TEXT_SIMILARITY_SCORE]: undefined;
    [SignalType.IMAGE_EXACT_MATCH]: undefined;
    [SignalType.IMAGE_SIMILARITY_SCORE]: undefined;
    [SignalType.IMAGE_SIMILARITY_DOES_NOT_MATCH]: undefined;
    [SignalType.IMAGE_SIMILARITY_MATCH]: undefined;
    [SignalType.GEO_CONTAINED_WITHIN]: undefined;
    [SignalType.USER_SCORE]: undefined;
    [SignalType.USER_STRIKE_VALUE]: undefined;
    [SignalType.BENIGN_MODEL]: undefined;
    [SignalType.OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_HATE_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_HATE_THREATENING_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SELF_HARM_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SEXUAL_MINORS_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SEXUAL_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_VIOLENCE_TEXT_MODEL]: undefined;
    [SignalType.CUSTOM]: undefined;
  },
  { [K in SignalType]: unknown }
>;

export type SignalArgs = SignalArgsByType[keyof SignalArgsByType];

export type RuntimeSignalArgsByType = Satisfies<
  {
    [SignalType.AGGREGATION]: AggregationRuntimeArgsForItem;
    [SignalType.GOOGLE_CLOUD_TRANSLATE_MODEL]: undefined;
    [SignalType.OPEN_AI_WHISPER_TRANSCRIPTION]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_TEXT]: undefined;
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_TEXT]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_REGEX]: undefined;
    [SignalType.TEXT_MATCHING_NOT_CONTAINS_REGEX]: undefined;
    [SignalType.TEXT_MATCHING_CONTAINS_VARIANT]: undefined;
    [SignalType.TEXT_SIMILARITY_SCORE]: undefined;
    [SignalType.IMAGE_EXACT_MATCH]: undefined;
    [SignalType.IMAGE_SIMILARITY_SCORE]: undefined;
    [SignalType.IMAGE_SIMILARITY_DOES_NOT_MATCH]: undefined;
    [SignalType.IMAGE_SIMILARITY_MATCH]: undefined;
    [SignalType.GEO_CONTAINED_WITHIN]: undefined;
    [SignalType.USER_SCORE]: undefined;
    [SignalType.USER_STRIKE_VALUE]: undefined;
    [SignalType.BENIGN_MODEL]: undefined;
    [SignalType.OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_HATE_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_HATE_THREATENING_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SELF_HARM_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SEXUAL_MINORS_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_SEXUAL_TEXT_MODEL]: undefined;
    [SignalType.OPEN_AI_VIOLENCE_TEXT_MODEL]: undefined;
    [SignalType.CUSTOM]: undefined;
  },
  { [K in SignalType]: unknown }
>;
