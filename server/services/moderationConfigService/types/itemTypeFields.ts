import { type ScalarType, type TaggedScalar } from '@roostorg/coop-types';

import { hasOwn } from '../../../utils/misc.js';
import { type NormalizedItemData } from '../../itemProcessingService/index.js';
import { type ItemType } from './itemTypes.js';

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
