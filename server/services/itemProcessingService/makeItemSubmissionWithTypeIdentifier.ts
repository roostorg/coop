import _ from 'lodash';
import { type Opaque, type UnwrapOpaque } from 'type-fest';

import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type ItemType,
  type ItemTypeIdentifier,
} from '../moderationConfigService/index.js';
import { type ItemSubmission } from './makeItemSubmission.js';

const { omit } = _;

export type ItemSubmissionWithTypeIdentifier<Type extends ItemType = ItemType> =
  Opaque<
    Omit<UnwrapOpaque<ItemSubmission<Type>>, 'itemType'> & {
      itemTypeIdentifier: ItemTypeIdentifier;
    },
    'ItemSubmissionWithTypeIdentifier'
  >;

export function itemSubmissionToItemSubmissionWithTypeIdentifier(
  it: ItemSubmission,
) {
  return instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
    ...omit(it, 'itemType'),
    itemTypeIdentifier: {
      id: it.itemType.id,
      version: it.itemType.version,
      schemaVariant: it.itemType.schemaVariant,
    },
  });
}

export function itemSubmissionWithTypeIdentifierToItemSubmission<
  T extends ItemType = ItemType,
>(it: ItemSubmissionWithTypeIdentifier, type: T) {
  return instantiateOpaqueType<ItemSubmission<T>>({
    submissionId: it.submissionId,
    submissionTime: it.submissionTime,
    itemId: it.itemId,
    creator: it.creator,
    data: it.data,
    itemType: type,
  });
}
