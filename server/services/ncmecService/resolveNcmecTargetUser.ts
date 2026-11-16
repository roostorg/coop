import { type ItemIdentifier } from '@roostorg/coop-types';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  getFieldValueForRole,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type ItemType } from '../moderationConfigService/types/itemTypes.js';

export type NcmecTargetUserResolution =
  | {
      success: true;
      userIdentifier: ItemIdentifier;
      userItemType: ItemType & { kind: 'USER' };
    }
  | { success: false; reason: 'UNSUPPORTED_ITEM_TYPE' }
  | { success: false; reason: 'MISSING_CREATOR' }
  | {
      success: false;
      reason: 'CREATOR_ITEM_TYPE_NOT_FOUND';
      creatorIdentifier: ItemIdentifier;
    }
  | {
      success: false;
      reason: 'CREATOR_ITEM_TYPE_NOT_USER';
      creatorIdentifier: ItemIdentifier;
      creatorItemType: ItemType;
    };

export type ValidatedNcmecTarget = {
  reportedItemType: ItemType;
  targetUser: Extract<NcmecTargetUserResolution, { success: true }>;
};

/**
 * Resolves the User that an NCMEC job targets without fetching the User's item
 * data. This keeps duplicate-report checks ahead of slower item lookups.
 */
export async function resolveNcmecTargetUser(opts: {
  orgId: string;
  itemId: string;
  itemType: ItemType;
  data: NormalizedItemData;
  moderationConfigService: Dependencies['ModerationConfigService'];
}): Promise<NcmecTargetUserResolution> {
  const { orgId, itemId, itemType, data, moderationConfigService } = opts;

  if (itemType.kind === 'USER') {
    return {
      success: true,
      userIdentifier: { id: itemId, typeId: itemType.id },
      userItemType: itemType,
    };
  }

  if (itemType.kind !== 'CONTENT') {
    return { success: false, reason: 'UNSUPPORTED_ITEM_TYPE' };
  }

  const creatorIdentifier = getFieldValueForRole(
    itemType.schema,
    itemType.schemaFieldRoles,
    'creatorId',
    data,
  );
  if (creatorIdentifier == null) {
    return { success: false, reason: 'MISSING_CREATOR' };
  }

  const creatorItemType = await moderationConfigService.getItemType({
    orgId,
    itemTypeSelector: { id: creatorIdentifier.typeId },
  });
  if (creatorItemType == null) {
    return {
      success: false,
      reason: 'CREATOR_ITEM_TYPE_NOT_FOUND',
      creatorIdentifier,
    };
  }
  if (creatorItemType.kind !== 'USER') {
    return {
      success: false,
      reason: 'CREATOR_ITEM_TYPE_NOT_USER',
      creatorIdentifier,
      creatorItemType,
    };
  }

  return {
    success: true,
    userIdentifier: creatorIdentifier,
    userItemType: creatorItemType,
  };
}
