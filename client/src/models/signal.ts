import {
  GQLIntegration,
  GQLScalarType,
  GQLSignal,
  GQLSignalOutputType,
  GQLSignalType,
  GQLValueComparator,
} from '../graphql/generated';
import { assertUnreachable } from '../utils/misc';

/**
 * Legacy-ish type for the core set of keys that signal keys that much of the
 * code currently assumes will be present on fetched signals.
 * @deprecated
 */
export type CoreSignal = Pick<
  GQLSignal,
  | 'id'
  | 'type'
  | 'name'
  | 'description'
  | 'disabledInfo'
  | 'shouldPromptForMatchingValues'
  | 'outputType'
  | 'eligibleSubcategories'
  | 'eligibleInputs'
  | 'subcategory'
  | 'integration'
  | 'integrationTitle'
  | 'integrationLogoUrl'
  | 'integrationLogoWithBackgroundUrl'
  | 'pricingStructure'
  | 'docsUrl'
  | 'recommendedThresholds'
  | 'supportedLanguages'
  | 'args'
  | 'allowedInAutomatedRules'
>;

/** Signal type is string to support plugin signal types (e.g. RANDOM_SIGNAL_SELECTION). */
export function receivesRegexInput(type: string) {
  return (
    type === GQLSignalType.TextMatchingContainsRegex ||
    type === GQLSignalType.TextMatchingNotContainsRegex
  );
}

/**
 * Returns the integration type for a given signal type.
 * @param type Signal type (built-in or plugin)
 * @returns a GQLIntegration enum value, or null for non-integration signals or plugin signals
 */
export function integrationForSignalType(type: string) {
  switch (type) {
    case 'GOOGLE_CONTENT_SAFETY_API_IMAGE':
      return GQLIntegration.GoogleContentSafetyApi;
    case 'OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL':
    case 'OPEN_AI_HATE_TEXT_MODEL':
    case 'OPEN_AI_HATE_THREATENING_TEXT_MODEL':
    case 'OPEN_AI_SELF_HARM_TEXT_MODEL':
    case 'OPEN_AI_SEXUAL_MINORS_TEXT_MODEL':
    case 'OPEN_AI_SEXUAL_TEXT_MODEL':
    case 'OPEN_AI_VIOLENCE_TEXT_MODEL':
    case 'OPEN_AI_WHISPER_TRANSCRIPTION':
      return GQLIntegration.OpenAi;
    case 'ZENTROPI_LABELER':
      return GQLIntegration.Zentropi;
    case 'AGGREGATION':
    case 'CUSTOM':
    case 'GEO_CONTAINED_WITHIN':
    case 'IMAGE_EXACT_MATCH':
    case 'IMAGE_SIMILARITY_MATCH':
    case 'IMAGE_SIMILARITY_DOES_NOT_MATCH':
    case 'IMAGE_SIMILARITY_SCORE':
    case 'TEXT_MATCHING_CONTAINS_REGEX':
    case 'TEXT_MATCHING_CONTAINS_TEXT':
    case 'TEXT_MATCHING_CONTAINS_VARIANT':
    case 'TEXT_MATCHING_NOT_CONTAINS_REGEX':
    case 'TEXT_MATCHING_NOT_CONTAINS_TEXT':
    case 'TEXT_SIMILARITY_SCORE':
    case 'USER_SCORE':
    case 'USER_STRIKE_VALUE':
    case 'BENIGN_MODEL':
      return null;
    default:
      // Plugin signal types (e.g. RANDOM_SIGNAL_SELECTION) or unknown: no built-in integration
      return null;
  }
}

export function outputTypeToComparators(outputType: GQLSignalOutputType) {
  const orderedComparators = [
    GQLValueComparator.Equals,
    GQLValueComparator.NotEqualTo,
    GQLValueComparator.GreaterThan,
    GQLValueComparator.GreaterThanOrEquals,
    GQLValueComparator.LessThan,
    GQLValueComparator.LessThanOrEquals,
    GQLValueComparator.IsUnavailable,
    GQLValueComparator.IsNotProvided,
  ];

  switch (outputType.scalarType) {
    case GQLScalarType.Number:
    case GQLScalarType.Datetime:
      return orderedComparators;
    case GQLScalarType.Id:
    case GQLScalarType.UserId:
    case GQLScalarType.Audio:
    case GQLScalarType.Image:
    case GQLScalarType.Video:
    case GQLScalarType.Geohash:
    case GQLScalarType.Boolean:
    case GQLScalarType.RelatedItem:
    case GQLScalarType.PolicyId:
      return [
        GQLValueComparator.Equals,
        GQLValueComparator.NotEqualTo,
        GQLValueComparator.IsUnavailable,
        GQLValueComparator.IsNotProvided,
      ];
    case GQLScalarType.Url:
    case GQLScalarType.String:
      return outputType.__typename === 'EnumSignalOutputType' &&
        outputType.ordered
        ? orderedComparators
        : [
            GQLValueComparator.Equals,
            GQLValueComparator.NotEqualTo,
            GQLValueComparator.IsUnavailable,
            GQLValueComparator.IsNotProvided,
          ];
    default:
      assertUnreachable(outputType.scalarType);
  }
}
