import { type JsonObject } from 'type-fest';

import { type Policy } from '../../services/moderationConfigService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type JSONSchemaV4 } from '../../utils/json-schema-types.js';
import { route } from '../../utils/route-helpers.js';
import {
  createPolicySchema,
  patchPolicySchema,
  type PolicyWrite,
} from '../configurationWrites.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getPolicies from './getPolicies.js';
import { createPolicy, patchPolicy } from './writePolicies.js';

export type GetPoliciesOutput = {
  policies: Omit<Policy, 'orgId' | 'createdAt' | 'updatedAt'>[];
};

export default {
  pathPrefix: '/policies',
  routes: [
    route.get<GetPoliciesOutput>('/', (deps) => [
      createApiKeyMiddleware<never, GetPoliciesOutput>(deps),
      getPolicies(deps),
    ]),
    route.post<PolicyWrite, JsonObject>(
      '/',
      { bodySchema: createPolicySchema as JSONSchemaV4<PolicyWrite> },
      (deps) => [createApiKeyMiddleware(deps), createPolicy(deps)],
    ),
    route.patch<Partial<PolicyWrite>, JsonObject>(
      '/:id',
      { bodySchema: patchPolicySchema as JSONSchemaV4<Partial<PolicyWrite>> },
      (deps) => [createApiKeyMiddleware(deps), patchPolicy(deps)],
    ),
  ] as ControllerRouteList,
} satisfies Controller;
