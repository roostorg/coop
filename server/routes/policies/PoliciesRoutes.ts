import { route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller, type ControllerRouteList } from '../index.js';
import getPolicies from './getPolicies.js';

export type GetPoliciesOutput = {
  policies: { id: string; name: string; parentId: string | null }[];
};

export default {
  pathPrefix: '/policies',
  routes: [
    route.get<GetPoliciesOutput>('/', (deps) => [createApiKeyMiddleware<never, GetPoliciesOutput>(deps), getPolicies(deps)]),
  ] as ControllerRouteList,
} satisfies Controller;
