import { type Dependencies } from '../../iocContainer/index.js';
import { makeBadRequestError } from '../../utils/errors.js';
import { type RequestHandlerWithBodies } from '../../utils/route-helpers.js';
import { hasOrgId } from '../../utils/apiKeyMiddleware.js';
import { type GetUserScoresOutput } from './UserScoresRoutes.js';

export default function getUserScores({
  getUserScoreEventuallyConsistent,
}: Dependencies): RequestHandlerWithBodies<never, GetUserScoresOutput> {
  return async (req, res, next) => {
    const id = req.query['id'];
    const typeId = req.query['typeId'];

    if (
      !id ||
      !typeId ||
      typeof id !== 'string' ||
      typeof typeId !== 'string'
    ) {
      return next(new Error('id and typeId are required'));
    }

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

    const userScore = await getUserScoreEventuallyConsistent(orgId, {
      id,
      typeId,
    });
    res.status(200).json(userScore);
  };
}
