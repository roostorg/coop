import { type IncomingMessage, type ServerResponse } from 'node:http';
import { defineConfig } from '@adonisjs/core/http';

import { corsHeaders } from '../app/middleware/cors_middleware.js';
import { securityHeaders } from '../app/middleware/helmet_middleware.js';
import { jsonStringify } from '../utils/encoding.js';
import { makeBadRequestError, sanitizeError } from '../utils/errors.js';

export const http = defineConfig({
  // AdonisJS v7 answers URLs it can't percent-decode before any middleware
  // runs, by default with a bare `400 text/plain`. Answer with Coop's JSON
  // error and the same CORS and security headers as every other response.
  onBadUrl(req: IncomingMessage, res: ServerResponse) {
    const noop = () => {};
    corsHeaders(req, res, noop);
    securityHeaders(req, res, noop);
    const body = jsonStringify({
      errors: [
        sanitizeError(
          makeBadRequestError('Malformed URL.', { shouldErrorSpan: false }),
        ),
      ],
    });
    res.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  },
  // Request ids are generated per route today (`toCorrelationId`), not by the
  // framework.
  generateRequestId: false,
  // Ignore `_method` overrides.
  allowMethodSpoofing: false,
  // Lets services read the current HttpContext without threading it through.
  useAsyncLocalStorage: true,
  // Weak ETags on bodies, as Express sent (see adonis/weakEtags.ts).
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
