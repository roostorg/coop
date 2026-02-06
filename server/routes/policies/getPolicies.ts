import { type Dependencies } from '../../iocContainer/index.js';
import { makeBadRequestError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { type GetPoliciesOutput } from './PoliciesRoutes.js';

export default function getPolicies({
  ModerationConfigService,
}: Dependencies): RequestHandlerWithBodies<never, GetPoliciesOutput> {
  return async (req, res, next) => {
    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(req)) {
      return next(
        makeBadRequestError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          shouldErrorSpan: true,
        }),
      );
    }
    
    const { orgId } = req;

    const policies = await ModerationConfigService.getPolicies({ orgId });
    res.status(200).json({
      policies: policies.map((it) => ({
        id: it.id,
        name: it.name,
        parentId: it.parentId ?? null,
      })),
    } satisfies GetPoliciesOutput);
  };
}
