import { Secret } from '@adonisjs/core/helpers';
import { defineConfig } from '@adonisjs/core/http';

import env from '../start/env.js';

/**
 * AdonisJS needs an application key for its encrypter and signed cookies. Coop
 * signs nothing with it (sessions stay on express-session, see
 * `app/middleware/session_bridge_middleware.ts`), so we derive it from the
 * existing SESSION_SECRET rather than introducing an APP_KEY env var. Workers
 * and CLI commands don't need SESSION_SECRET, so they get a throwaway key.
 */
export const appKey = new Secret(
  env.get('SESSION_SECRET') ?? 'coop-no-session-secret-configured',
);

export const http = defineConfig({
  // Request ids are generated per route today (`toCorrelationId`), not by the
  // framework.
  generateRequestId: false,
  // Ignore `_method` overrides; Express didn't support them.
  allowMethodSpoofing: false,
  // Lets services read the current HttpContext without threading it through.
  useAsyncLocalStorage: true,
  // Express' `res.json()`/`res.send()` set a weak ETag; keep that header.
  etag: true,
  // `trust proxy: true` in the Express app; see force_https_middleware.ts.
  trustProxy: () => true,
  cookie: {},
  // Express 5 parses query strings with Node's `querystring` ("simple"),
  // which never builds nested objects or arrays from `a[b]=1`. Match that so
  // `req.query` values keep their shape.
  qs: {
    parse: { depth: 0, arrayLimit: 0 },
  },
});
