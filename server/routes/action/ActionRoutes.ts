import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller } from '../index.js';
import getActions, { type GetActionsOutput } from './getActions.js';

// POST / is `app/controllers/actions_controller.ts`.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/actions',
  routes: [
    route.get<GetActionsOutput>(
      '/',
      { middleware: (deps) => [createApiKeyMiddleware(deps)] },
      getActions,
    ),
  ],
} as Controller;
