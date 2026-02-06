import { makeEnumLike } from '@roostorg/types';

import { enumToArbitrary } from '../../../test/propertyTestingHelpers.js';
import { assertUnreachable } from '../../../utils/misc.js';
import { Integration } from './Integration.js';

// Internal signal types are always built-in signals.
export type InternalSignalType = keyof typeof InternalSignalType;

// External (i.e., user-visible) signals could be built-in or user-created.
export type BuiltInExternalSignalType = keyof typeof BuiltInExternalSignalType;
export type UserCreatedExternalSignalType =
  keyof typeof UserCreatedExternalSignalType;
export type ExternalSignalType = keyof typeof ExternalSignalType;

export type BuiltInSignalType = keyof typeof BuiltInSignalType;
export type SignalType = keyof typeof SignalType;

export const InternalSignalType = makeEnumLike([
  'GOOGLE_CLOUD_TRANSLATE_MODEL',
  'OPEN_AI_WHISPER_TRANSCRIPTION',
]);

export const BuiltInExternalSignalType = makeEnumLike([
  'TEXT_MATCHING_CONTAINS_TEXT',
  'TEXT_MATCHING_NOT_CONTAINS_TEXT',
  'TEXT_MATCHING_CONTAINS_REGEX',
  'TEXT_MATCHING_NOT_CONTAINS_REGEX',
  'TEXT_MATCHING_CONTAINS_VARIANT',
  'TEXT_SIMILARITY_SCORE',
  'IMAGE_EXACT_MATCH',
  'IMAGE_SIMILARITY_SCORE',
  'IMAGE_SIMILARITY_DOES_NOT_MATCH',
  'IMAGE_SIMILARITY_MATCH',
  'GEO_CONTAINED_WITHIN',
  'USER_STRIKE_VALUE',
  'USER_SCORE',
  'AGGREGATION',
]);

export const BuiltInThirdPartySignalType = makeEnumLike([
  'BENIGN_MODEL',
  'OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL',
  'OPEN_AI_HATE_TEXT_MODEL',
  'OPEN_AI_HATE_THREATENING_TEXT_MODEL',
  'OPEN_AI_SELF_HARM_TEXT_MODEL',
  'OPEN_AI_SEXUAL_MINORS_TEXT_MODEL',
  'OPEN_AI_SEXUAL_TEXT_MODEL',
  'OPEN_AI_VIOLENCE_TEXT_MODEL',
]);

export const UserCreatedExternalSignalType = makeEnumLike(['CUSTOM']);

export const ExternalSignalType = {
  ...BuiltInExternalSignalType,
  ...BuiltInThirdPartySignalType,
  ...UserCreatedExternalSignalType,
};

export const BuiltInSignalType = {
  ...InternalSignalType,
  ...BuiltInExternalSignalType,
  ...BuiltInThirdPartySignalType,
};

/**
 * This enum-like object contains all the Signals that users can use in
 * their Rules. There is one CUSTOM signal, which represents any custom signal
 * the user exposes with a REST API endpoint. The rest of the SignalTypes
 * are signals that we (Coop) offer as out-of-the-box signals.
 */
export const SignalType = {
  ...InternalSignalType,
  ...ExternalSignalType,
};

export const InternalSignalTypeArbitrary = enumToArbitrary(InternalSignalType);
export const BuiltInExternalSignalTypeArbitrary = enumToArbitrary(
  BuiltInExternalSignalType,
);
export const UserCreatedExternalSignalTypeArbitrary = enumToArbitrary(
  UserCreatedExternalSignalType,
);
export const ExternalSignalTypeArbitrary = enumToArbitrary(ExternalSignalType);

// eslint-disable-next-line complexity
export function integrationForSignalType(type: SignalType) {
  switch (type) {
    case 'OPEN_AI_GRAPHIC_VIOLENCE_TEXT_MODEL':
    case 'OPEN_AI_HATE_TEXT_MODEL':
    case 'OPEN_AI_HATE_THREATENING_TEXT_MODEL':
    case 'OPEN_AI_SELF_HARM_TEXT_MODEL':
    case 'OPEN_AI_SEXUAL_MINORS_TEXT_MODEL':
    case 'OPEN_AI_SEXUAL_TEXT_MODEL':
    case 'OPEN_AI_VIOLENCE_TEXT_MODEL':
    case 'OPEN_AI_WHISPER_TRANSCRIPTION':
      return Integration.OPEN_AI;
    case 'AGGREGATION':
    case 'CUSTOM':
    case 'GEO_CONTAINED_WITHIN':
    case 'GOOGLE_CLOUD_TRANSLATE_MODEL':
    case 'IMAGE_EXACT_MATCH':
    case 'IMAGE_SIMILARITY_SCORE':
    case 'IMAGE_SIMILARITY_DOES_NOT_MATCH':
    case 'IMAGE_SIMILARITY_MATCH':
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
      assertUnreachable(type);
  }
}
