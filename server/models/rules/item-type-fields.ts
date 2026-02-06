import {
  ScalarTypes,
  type ScalarType,
  type TaggedScalar,
} from '@roostorg/types';

import { type NormalizedItemData } from '../../services/itemProcessingService/index.js';
import { type ItemType } from '../../services/moderationConfigService/index.js';
import { hasOwn } from '../../utils/misc.js';

export type TaggedItemData = Readonly<{
  itemType: ItemType;
  data: NormalizedItemData;
}>;

// We don't do `it: unknown` because our check here is really only precise enough
// to distinguish TaggedContent from a few other types.
export function isTaggedItemData(
  it: TaggedItemData | TaggedScalar<ScalarType> | unknown[],
): it is TaggedItemData {
  return hasOwn(it, 'itemType');
}

export function isTranscribableType(
  it: ScalarType,
): it is ScalarTypes['AUDIO'] | ScalarTypes['VIDEO'] {
  return it === ScalarTypes.AUDIO || it === ScalarTypes.VIDEO;
}

export function isTextValue<T extends ScalarType>(
  it: TaggedScalar<T>,
): it is TaggedScalar<T & ScalarTypes['STRING']> {
  return it.type === ScalarTypes.STRING;
}

export function isTranscribableValue<T extends ScalarType>(
  it: TaggedScalar<T>,
): it is TaggedScalar<T & (ScalarTypes['AUDIO'] | ScalarTypes['VIDEO'])> {
  return isTranscribableType(it.type);
}
