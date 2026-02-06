import { route, type Route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import getUserScores from './getUserScores.js';

export type GetUserScoresOutput = number;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/user_scores',
  routes: [
    route.get<GetUserScoresOutput>('/', (deps) => [createApiKeyMiddleware<never, GetUserScoresOutput>(deps), getUserScores(deps)]) as Route<
      any,
      GetUserScoresOutput
    >,
  ],
} as Controller;
