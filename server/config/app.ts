import { defineConfig } from '@adonisjs/core/http';

export const http = defineConfig({
  // Request ids are generated per route today (`toCorrelationId`), not by the
  // framework.
  generateRequestId: false,
  // Ignore `_method` overrides.
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
    // AdonisJS v7 also splits values on commas by default (`a=1,2` becomes
    // an array); Node's parser doesn't.
    parse: { depth: 0, comma: false },
  },
});
