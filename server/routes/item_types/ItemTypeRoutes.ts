import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getItemTypes, { type GetItemTypesOutput } from './getItemTypes.js';

export default {
  pathPrefix: '/item_types',
  routes: [
    route.get<GetItemTypesOutput>('/', (deps) => [
      createApiKeyMiddleware<never, GetItemTypesOutput>(deps),
      getItemTypes(deps),
    ]),
  ] as ControllerRouteList,
} satisfies Controller;
