import { type JsonObject } from 'type-fest';
import { type InferOutput } from 'valibot';

import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import {
  createItemTypeSchema,
  patchItemTypeSchema,
} from '../configurationWrites.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getItemTypes, { type GetItemTypesOutput } from './getItemTypes.js';
import { createItemType, patchItemType } from './writeItemTypes.js';

export default {
  pathPrefix: '/item_types',
  routes: [
    route.get<GetItemTypesOutput>('/', (deps) => [
      createApiKeyMiddleware<never, GetItemTypesOutput>(deps),
      getItemTypes(deps),
    ]),
    route.post<InferOutput<typeof createItemTypeSchema>, JsonObject>(
      '/',
      { bodySchema: createItemTypeSchema },
      (deps) => [createApiKeyMiddleware(deps), createItemType(deps)],
    ),
    route.patch<InferOutput<typeof patchItemTypeSchema>, JsonObject>(
      '/:id',
      { bodySchema: patchItemTypeSchema },
      (deps) => [createApiKeyMiddleware(deps), patchItemType(deps)],
    ),
  ] as ControllerRouteList,
} satisfies Controller;
