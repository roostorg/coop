import {
  GQLScalarType,
  GQLSignalOutputType,
  GQLSignalType,
  GQLValueComparator,
} from '../graphql/generated';
import { assertUnreachable } from '../utils/misc';

/** Signal type is string to support plugin signal types (e.g. RANDOM_SIGNAL_SELECTION). */
export function receivesRegexInput(type: string) {
  return (
    type === GQLSignalType.TextMatchingContainsRegex ||
    type === GQLSignalType.TextMatchingNotContainsRegex
  );
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
    case GQLScalarType.Media:
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
    case GQLScalarType.IpAddress:
    case GQLScalarType.EmailAddress:
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
