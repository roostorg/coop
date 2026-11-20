import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import { trace } from '@opentelemetry/api';
import { ATTR_HTTP_ROUTE } from '@opentelemetry/semantic-conventions';

import { jsonStringify } from '../../utils/encoding.js';

/**
 * Names the HTTP server span after the matched route (`POST /api/v1/...`)
 * and sets `http.route`; without this, `nodejs-instrumentation`'s HTTP spans
 * are named just `POST`. Also records the request body when
 * LOG_REQUEST_BODY=true. `@adonisjs/otel`'s middleware does the first part,
 * but the package also starts its own OpenTelemetry SDK, which would clash
 * with the `nodejs-instrumentation` preload.
 */
export default class RequestSpanMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const span = trace.getActiveSpan();
    const pattern = ctx.route?.pattern;
    if (span && pattern) {
      span.setAttribute(ATTR_HTTP_ROUTE, pattern);
      span.updateName(`${ctx.request.method()} ${pattern}`);
      if (process.env.LOG_REQUEST_BODY === 'true') {
        span.setAttribute(
          'http.request.body',
          jsonStringify(ctx.request.body()),
        );
      }
    }
    return next();
  }
}
