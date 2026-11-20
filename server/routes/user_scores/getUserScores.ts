import { type Dependencies } from '../../iocContainer/index.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { makeBadRequestError } from '../../utils/errors.js';
import { type RouteHandler } from '../../utils/route-helpers.js';
import { type GetUserScoresOutput } from './UserScoresRoutes.js';

export default function getUserScores({
  getUserScoreEventuallyConsistent,
}: Dependencies): RouteHandler<never, GetUserScoresOutput> {
  return async (ctx) => {
    const id = ctx.request.qs()['id'];
    const typeId = ctx.request.qs()['typeId'];

    if (
      !id ||
      !typeId ||
      typeof id !== 'string' ||
      typeof typeId !== 'string'
    ) {
      throw new Error('id and typeId are required');
    }

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

    const userScore = await getUserScoreEventuallyConsistent(orgId, {
      id,
      typeId,
    });
    return userScore;
  };
}
