import { route, type Route } from '../../utils/route-helpers.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { type Controller } from '../index.js';
import getPolicies from './getPolicies.js';

export type GetPoliciesOutput = {
  policies: { id: string; name: string; parentId: string | null }[];
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  pathPrefix: '/policies',
  routes: [
    route.get<GetPoliciesOutput>('/', (deps) => [createApiKeyMiddleware<never, GetPoliciesOutput>(deps), getPolicies(deps)]) as Route<
      any,
      GetPoliciesOutput
    >,
  ],
} as Controller;
