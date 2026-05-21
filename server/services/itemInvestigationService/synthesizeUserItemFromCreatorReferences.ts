import { type ItemIdentifier } from '@roostorg/types';

import { type Dependencies } from '../../iocContainer/index.js';
import { type IActionExecutionsAdapter } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import { type IContentApiRequestsAdapter } from '../../plugins/warehouse/queries/IContentApiRequestsAdapter.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type ItemSubmission,
  type NormalizedItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import { type UserItemType } from '../moderationConfigService/index.js';

export type SyntheticUserItemSubmissionsForItem = {
  latestSubmission: ItemSubmission;
  priorSubmissions: undefined;
};

const EMPTY_NORMALIZED_DATA: NormalizedItemData =
  instantiateOpaqueType<NormalizedItemData>({});

/** Sentinel id so callers/logs can recognize synthetic submissions. */
export function makeSyntheticSubmissionId(itemId: string): SubmissionId {
  return instantiateOpaqueType<SubmissionId>(`synthetic:${itemId}`);
}

export function makeSyntheticUserSubmission(
  itemId: string,
  itemType: UserItemType,
): ItemSubmission {
  return instantiateOpaqueType<ItemSubmission>({
    submissionId: makeSyntheticSubmissionId(itemId),
    submissionTime: undefined,
    itemId,
    creator: undefined,
    data: EMPTY_NORMALIZED_DATA,
    itemType,
  });
}

/**
 * Resolve a `UserItem` for an id we never received by following indirect
 * references. Tries Scylla `item_submission_by_creator`, then ClickHouse
 * `ACTION_EXECUTIONS`, then `CONTENT_API_REQUESTS`. Without `knownUserTypeId`
 * the Scylla sweep issues one call per USER type in the org (parallel).
 */
export async function synthesizeUserItemFromCreatorReferences(opts: {
  orgId: string;
  itemId: string;
  knownUserTypeId?: string;
  scyllaCreatorRefExists: (input: {
    orgId: string;
    creatorIdentifier: ItemIdentifier;
  }) => Promise<boolean>;
  actionExecutionsAdapter: Pick<
    IActionExecutionsAdapter,
    'findInferredUserIdentity'
  >;
  contentApiRequestsAdapter: Pick<
    IContentApiRequestsAdapter,
    'findInferredUserIdentityFromCreators'
  >;
  moderationConfigService: Pick<
    Dependencies['ModerationConfigService'],
    'getItemType' | 'getItemTypes'
  >;
}): Promise<SyntheticUserItemSubmissionsForItem | null> {
  const {
    orgId,
    itemId,
    knownUserTypeId,
    scyllaCreatorRefExists,
    actionExecutionsAdapter,
    contentApiRequestsAdapter,
    moderationConfigService,
  } = opts;

  // Fast path: pinned type + Scylla creator ref. Misses fall through to
  // inference, so this is a fast-path filter, not a typo-rejection guard.
  let pinnedTypeAlreadyChecked: string | null = null;
  if (knownUserTypeId !== undefined) {
    const pinnedType = await moderationConfigService.getItemType({
      orgId,
      itemTypeSelector: { id: knownUserTypeId },
    });
    if (pinnedType && pinnedType.kind === 'USER') {
      pinnedTypeAlreadyChecked = pinnedType.id;
      const referenced = await scyllaCreatorRefExists({
        orgId,
        creatorIdentifier: { id: itemId, typeId: knownUserTypeId },
      });
      if (referenced) {
        return {
          latestSubmission: makeSyntheticUserSubmission(itemId, pinnedType),
          priorSubmissions: undefined,
        };
      }
    }
  }

  const allTypes = await moderationConfigService.getItemTypes({ orgId });
  const userTypesToSweep = allTypes.filter(
    (t): t is UserItemType =>
      t.kind === 'USER' && t.id !== pinnedTypeAlreadyChecked,
  );

  if (userTypesToSweep.length > 0) {
    const lookups = await Promise.all(
      userTypesToSweep.map(async (userType) => {
        const referenced = await scyllaCreatorRefExists({
          orgId,
          creatorIdentifier: { id: itemId, typeId: userType.id },
        });
        return referenced ? userType : null;
      }),
    );
    const matchedType = lookups.find((t): t is UserItemType => t !== null);
    if (matchedType) {
      return {
        latestSubmission: makeSyntheticUserSubmission(itemId, matchedType),
        priorSubmissions: undefined,
      };
    }
  }

  const fromActions = await actionExecutionsAdapter.findInferredUserIdentity({
    orgId,
    itemId,
  });

  const inferred =
    fromActions ??
    (await contentApiRequestsAdapter.findInferredUserIdentityFromCreators({
      orgId,
      itemId,
    }));

  if (!inferred) {
    return null;
  }

  const itemType = await moderationConfigService.getItemType({
    orgId,
    itemTypeSelector: { id: inferred.itemTypeId },
  });

  if (!itemType || itemType.kind !== 'USER') {
    return null;
  }

  return {
    latestSubmission: makeSyntheticUserSubmission(itemId, itemType),
    priorSubmissions: undefined,
  };
}
