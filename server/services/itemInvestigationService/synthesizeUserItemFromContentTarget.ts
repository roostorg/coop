import { type Dependencies } from '../../iocContainer/index.js';
import { type IActionExecutionsAdapter } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import { type IContentApiRequestsAdapter } from '../../plugins/warehouse/queries/IContentApiRequestsAdapter.js';
import {
  synthesizeUserItemFromCreatorReferences,
  type SyntheticUserItemSubmissionsForItem,
} from './synthesizeUserItemFromCreatorReferences.js';

/**
 * Resolve a synthetic `UserItem` submission for the *creator* of a CONTENT
 * item whose own submission record is missing. Looks up the most-recent
 * `(creator_id, creator_type_id)` for `(itemId, itemTypeId)` in
 * `ACTION_EXECUTIONS`, then delegates to
 * `synthesizeUserItemFromCreatorReferences` with the resolved user id so the
 * returned submission is keyed on the creator (not the content).
 */
export async function synthesizeUserItemFromContentTarget(opts: {
  orgId: string;
  itemId: string;
  itemTypeId: string;
  actionExecutionsAdapter: Pick<
    IActionExecutionsAdapter,
    'findContentCreatorIdentity' | 'findInferredUserIdentity'
  >;
  contentApiRequestsAdapter: Pick<
    IContentApiRequestsAdapter,
    'findInferredUserIdentityFromCreators'
  >;
  scyllaCreatorRefExists: Parameters<
    typeof synthesizeUserItemFromCreatorReferences
  >[0]['scyllaCreatorRefExists'];
  moderationConfigService: Pick<
    Dependencies['ModerationConfigService'],
    'getItemType' | 'getItemTypes'
  >;
}): Promise<SyntheticUserItemSubmissionsForItem | null> {
  const {
    orgId,
    itemId,
    itemTypeId,
    actionExecutionsAdapter,
    contentApiRequestsAdapter,
    scyllaCreatorRefExists,
    moderationConfigService,
  } = opts;

  const creator = await actionExecutionsAdapter.findContentCreatorIdentity({
    orgId,
    itemId,
    itemTypeId,
  });

  if (!creator) {
    return null;
  }

  return synthesizeUserItemFromCreatorReferences({
    orgId,
    itemId: creator.creatorId,
    knownUserTypeId: creator.creatorTypeId,
    scyllaCreatorRefExists,
    actionExecutionsAdapter,
    contentApiRequestsAdapter,
    moderationConfigService,
  });
}
