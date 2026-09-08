import { type ReadonlyDeep } from 'type-fest';

import { type Dependencies } from '../../iocContainer/index.js';
import { type ItemType } from '../../services/moderationConfigService/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { makeUnauthenticatedError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';

export type GetItemTypesOutput = {
  itemTypes: readonly ReadonlyDeep<ItemType>[];
};

export default function getItemTypes({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<never, GetItemTypesOutput> {
  return async (req, res, next) => {
    if (!hasOrgId(req)) {
      return next(
        makeUnauthenticatedError('Invalid API Key', { shouldErrorSpan: true }),
      );
    }
    const itemTypes = await ModerationConfigService.getItemTypes({
      orgId: req.orgId,
      directives: { maxAge: 0 },
    });
    res.status(200).json({ itemTypes });
  };
}
