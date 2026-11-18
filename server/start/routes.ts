import { type Router } from '@adonisjs/core/http';

import { type Dependencies } from '../iocContainer/index.js';
import controllers from '../routes/index.js';
import {
  createBodySchemaValidator,
  jsonBody,
} from '../utils/bodySchemaValidation.js';
import { jsonStringify } from '../utils/encoding.js';
import { type NamedMiddleware } from './kernel.js';

const GraphqlController = async () =>
  import('../app/controllers/graphql_controller.js');
const SamlController = async () =>
  import('../app/controllers/saml_controller.js');

/**
 * All of the public API, under `/api/v1`. `deps` is passed to each REST
 * route's handler factory once at boot, as the Express app did.
 */
export function registerRoutes(
  router: Router,
  deps: Dependencies,
  middleware: NamedMiddleware,
) {
  router
    .group(() => {
      // No session lookup for the load balancer's health check.
      router.get('/ready', async ({ response }) => {
        response.header('Content-Type', 'text/html; charset=utf-8');
        return 'Healthy';
      });

      router
        .group(() => {
          router.get('/saml/login/:orgId', [SamlController, 'login']);
          router.post('/saml/login/:orgId/callback', [
            SamlController,
            'callback',
          ]);

          router.any('/graphql', [GraphqlController, 'handle']);

          for (const controller of Object.values(controllers)) {
            for (const it of controller.routes) {
              const handler = it.handler(deps);
              const pattern = joinPath(controller.pathPrefix, it.path);
              const route = router[it.method](pattern, async (ctx) => {
                const result = await handler(ctx, jsonBody(ctx) as never);
                // Always JSON, as `res.json()` was. AdonisJS' `json()` is an
                // alias of `send()`, which sends a number or string as
                // text/plain.
                if (result !== undefined) {
                  ctx.response
                    .header('Content-Type', 'application/json; charset=utf-8')
                    .send(jsonStringify(result));
                }
              });
              // Body validation runs before the route's own middleware (e.g.
              // the API key check), so a malformed body is a 400 even without
              // a valid key, as it was under Express.
              if (it.bodySchema) {
                route.use(createBodySchemaValidator(it.bodySchema));
              }
              for (const fn of it.middleware?.(deps) ?? []) {
                route.use(fn);
              }
              if (it.name) {
                route.as(it.name);
              }
            }
          }
        })
        .use(middleware.session());
    })
    .prefix('/api/v1');
}

function joinPath(prefix: string, path: string) {
  const joined = `${prefix}/${path}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}
