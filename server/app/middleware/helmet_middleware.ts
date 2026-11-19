import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import helmet from 'helmet';

export const securityHeaders = helmet(
  process.env.NODE_ENV === 'production'
    ? {}
    : {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            frameSrc: ["'self'"],
          },
        },
      },
);

/**
 * helmet sets its headers with `res.setHeader`, so it runs unchanged on the
 * Node response. `@adonisjs/shield` covers CSP, HSTS, X-Frame-Options and
 * nosniff but not helmet's other headers (COOP, CORP, Origin-Agent-Cluster,
 * Referrer-Policy, X-DNS-Prefetch-Control, ...), so it isn't a drop-in
 * replacement.
 */
export default class HelmetMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await new Promise<void>((resolve, reject) => {
      securityHeaders(
        ctx.request.request,
        ctx.response.response,
        (err?: unknown) => (err ? reject(err) : resolve()),
      );
    });
    return next();
  }
}
