import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { type ItemType } from '../../services/moderationConfigService/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { makeUnauthenticatedError } from '../../utils/errors.js';
import { type RouteHandler } from '../../utils/route-helpers.js';

export type GetItemTypesOutput = {
  itemTypes: readonly ReadonlyDeep<Omit<ItemType, 'orgId'>>[];
};

export default function getItemTypes({
  ModerationConfigService,
}: Dependencies): RouteHandler<never, GetItemTypesOutput> {
  return async (ctx) => {
    if (!hasOrgId(ctx)) {
      throw makeUnauthenticatedError('Invalid API Key', {
        shouldErrorSpan: true,
      });
    }
    const itemTypes = await ModerationConfigService.getItemTypes({
      orgId: ctx.orgId,
      directives: { maxAge: 0 },
    });
    return {
      itemTypes: itemTypes.map(({ orgId: _orgId, ...itemType }) => itemType),
    };
  };
}
