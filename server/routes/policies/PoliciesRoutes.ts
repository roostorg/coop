import { type JsonObject } from 'type-fest';
import { type InferOutput } from 'valibot';

import { type Policy } from '../../services/moderationConfigService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import {
  createPolicySchema,
  patchPolicySchema,
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
    route.post<InferOutput<typeof createPolicySchema>, JsonObject>(
      '/',
      { bodySchema: createPolicySchema },
      (deps) => [createApiKeyMiddleware(deps), createPolicy(deps)],
    ),
    route.patch<InferOutput<typeof patchPolicySchema>, JsonObject>(
      '/:id',
      { bodySchema: patchPolicySchema },
      (deps) => [createApiKeyMiddleware(deps), patchPolicy(deps)],
    ),
  ] as ControllerRouteList,
} satisfies Controller;
