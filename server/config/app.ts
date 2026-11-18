import { randomBytes } from 'node:crypto';
import { Secret } from '@adonisjs/core/helpers';
import { defineConfig } from '@adonisjs/core/http';

/**
 * AdonisJS needs an application key for its encrypter and signed cookies.
 * Nothing in Coop uses either (sessions stay on express-session, see
 * `app/middleware/session_bridge_middleware.ts`), so rather than add an
 * APP_KEY env var, the key is a random value per process. Anything that
 * starts using AdonisJS encryption needs a real, shared key first.
 */
export const appKey = new Secret(randomBytes(32).toString('base64url'));

export const http = defineConfig({
  // Request ids are generated per route today (`toCorrelationId`), not by the
  // framework.
  generateRequestId: false,
  // Ignore `_method` overrides; Express didn't support them.
  allowMethodSpoofing: false,
  // Lets services read the current HttpContext without threading it through.
  useAsyncLocalStorage: true,
  // Weak ETags on bodies, which API clients may already cache on.
  etag: true,
  // Behind NLB -> ALB; see force_https_middleware.ts.
  trustProxy: () => true,
  cookie: {},
  // Express 5 parses query strings with Node's `querystring` ("simple"),
  // which never builds nested objects or arrays from `a[b]=1`. Match that so
  // `req.query` values keep their shape.
  qs: {
    parse: { depth: 0 },
  },
});
