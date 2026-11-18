import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import cors from 'cors';

const corsHeaders = cors();

/**
 * The `cors` package with its defaults, run on the Node request and response,
 * as in the Express app. `@adonisjs/cors` isn't a drop-in replacement: it sets
 * no CORS headers when a request has no `Origin` header, and omits
 * `Vary: Access-Control-Request-Headers` and `Content-Length: 0` on preflights.
 * Preflights (OPTIONS) end here with a 204, for any path.
 */
export default class CorsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const continued = await new Promise<boolean>((resolve, reject) => {
      const res = ctx.response.response;
      const onFinish = () => resolve(false);
      res.once('finish', onFinish);
      corsHeaders(ctx.request.request, res, (err?: unknown) => {
        res.off('finish', onFinish);
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
    return continued ? next() : undefined;
  }
}
