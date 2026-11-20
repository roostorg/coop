import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getItemTypes, { type GetItemTypesOutput } from './getItemTypes.js';

export default {
  pathPrefix: '/item_types',
  routes: [
    route.get<GetItemTypesOutput>(
      '/',
      { middleware: (deps) => [createApiKeyMiddleware(deps)] },
      getItemTypes,
    ),
  ] as ControllerRouteList,
} satisfies Controller;
