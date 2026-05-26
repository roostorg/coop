import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getUserScores from './getUserScores.js';

export type GetUserScoresOutput = number;

export default {
  pathPrefix: '/user_scores',
  routes: [
    route.get<GetUserScoresOutput>('/', (deps) => [createApiKeyMiddleware<never, GetUserScoresOutput>(deps), getUserScores(deps)]),
  ] as ControllerRouteList,
} satisfies Controller;
