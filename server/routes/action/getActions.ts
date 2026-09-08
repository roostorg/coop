import { type JsonValue } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  parseStoredParameters,
  serializeParameters,
  type Action,
} from '../../services/moderationConfigService/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { makeUnauthenticatedError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';

export type GetActionsOutput = {
  actions: (Pick<
    Action,
    | 'id'
    | 'orgId'
    | 'name'
    | 'description'
    | 'actionType'
    | 'applyUserStrikes'
    | 'penalty'
  > & { itemTypeIds: string[]; parameters: JsonValue[] })[];
};

export default function getActions({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<never, GetActionsOutput> {
  return async (req, res, next) => {
    if (!hasOrgId(req)) {
      return next(
        makeUnauthenticatedError('Invalid API Key', { shouldErrorSpan: true }),
      );
    }
    const { orgId } = req;
    const actions = await ModerationConfigService.getActions({ orgId });
    const itemTypeIds = await ModerationConfigService.getActionItemTypeIds({
      orgId,
    });
    const output = actions.map((action) => ({
      // Explicitly allowlist metadata: webhook URLs, headers, and bodies may
      // contain credentials and must never be exposed by this read API.
      id: action.id,
      orgId: action.orgId,
      name: action.name,
      description: action.description,
      actionType: action.actionType,
      applyUserStrikes: action.applyUserStrikes,
      penalty: action.penalty,
      itemTypeIds: itemTypeIds.get(action.id) ?? [],
      parameters: serializeParameters(
        parseStoredParameters(
          action.actionType === 'CUSTOM_ACTION'
            ? action.customMrtApiParams
            : null,
        ),
      ),
    }));
    res.status(200).json({ actions: output });
  };
}
