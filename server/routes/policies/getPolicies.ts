import { type Dependencies } from '../../iocContainer/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { makeBadRequestError } from '../../utils/errors.js';
import { type RouteHandler } from '../../utils/route-helpers.js';
import { type GetPoliciesOutput } from './PoliciesRoutes.js';

export default function getPolicies({
  ModerationConfigService,
}: Dependencies): RouteHandler<never, GetPoliciesOutput> {
  return async (ctx) => {
    // Get orgId from request (set by API key middleware)
    if (!hasOrgId(ctx)) {
      throw makeBadRequestError('Invalid API Key', {
        detail:
          'Something went wrong finding or validating your API key. ' +
          'Make sure the proper key is provided in the x-api-key header.',
        shouldErrorSpan: true,
      });
    }

    const { orgId } = ctx;

    const policies = await ModerationConfigService.getPolicies({ orgId });
    return {
      policies: policies.map((it) => ({
        id: it.id,
        name: it.name,
        parentId: it.parentId ?? null,
        policyText: it.policyText,
        enforcementGuidelines: it.enforcementGuidelines,
        policyType: it.policyType,
        semanticVersion: it.semanticVersion,
        userStrikeCount: it.userStrikeCount,
        applyUserStrikeCountConfigToChildren:
          it.applyUserStrikeCountConfigToChildren,
        penalty: it.penalty,
      })),
    } satisfies GetPoliciesOutput;
  };
}
