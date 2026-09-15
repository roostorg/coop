import { type JsonObject } from 'type-fest';

import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type JSONSchemaV4 } from '../../utils/json-schema-types.js';
import { route } from '../../utils/route-helpers.js';
import {
  createItemTypeSchema,
  patchItemTypeSchema,
  type ItemTypeWrite,
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
    route.post<ItemTypeWrite, JsonObject>(
      '/',
      { bodySchema: createItemTypeSchema as JSONSchemaV4<ItemTypeWrite> },
      (deps) => [createApiKeyMiddleware(deps), createItemType(deps)],
    ),
    route.patch<ItemTypeWrite, JsonObject>(
      '/:id',
      { bodySchema: patchItemTypeSchema as JSONSchemaV4<ItemTypeWrite> },
      (deps) => [createApiKeyMiddleware(deps), patchItemType(deps)],
    ),
  ] as ControllerRouteList,
} satisfies Controller;
