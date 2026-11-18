import { type Router, type Server } from '@adonisjs/core/http';

/**
 * Global middleware, run for every request (including unmatched ones, so CORS
 * preflights to any path get an answer, as with Express).
 */
export function registerKernel(server: Server, router: Router) {
  server.errorHandler(async () => import('../app/exceptions/handler.js'));

  server.use([
    async () => import('../app/middleware/force_https_middleware.js'),
    async () => import('@adonisjs/cors/cors_middleware'),
    async () => import('../app/middleware/helmet_middleware.js'),
  ]);

  // Run for matched routes only.
  router.use([
    async () => import('@adonisjs/core/bodyparser_middleware'),
    async () => import('../app/middleware/request_span_middleware.js'),
  ]);

  // Middleware that routes opt into by name.
  return router.named({
    session: async () => import('../app/middleware/session_bridge_middleware.js'),
  });
}

export type NamedMiddleware = ReturnType<typeof registerKernel>;
