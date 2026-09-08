import { type Policy } from '../../services/moderationConfigService/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { route } from '../../utils/route-helpers.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getPolicies from './getPolicies.js';

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
  ] as ControllerRouteList,
} satisfies Controller;
