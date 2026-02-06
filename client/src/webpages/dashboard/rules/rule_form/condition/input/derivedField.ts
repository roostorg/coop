import {
  GQLDerivedFieldDerivationType,
  GQLScalarType,
} from '../../../../../../graphql/generated';

/**
 * This determines the output type of the derived field type passed in.
 * Each derived field takes an input (aka "source") and produces an output,
 * and that output is fed into a signal. For the Rule Form UI, we need to know
 * the derived field's output type so we know which signals its output can
 * run on.
 *
 * TODO: remove this function and instead get the output type from the backend,
 * which returns the output type in the content type's `derivedFields` field.
 */
export function getDerivedFieldOutputType(
  derivationType: GQLDerivedFieldDerivationType,
) {
  switch (derivationType) {
    case 'ENGLISH_TRANSLATION':
    case 'VIDEO_TRANSCRIPTION':
      return GQLScalarType.String;
  }
}
