import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import { trace } from '@opentelemetry/api';
import { ATTR_HTTP_ROUTE } from '@opentelemetry/semantic-conventions';

import { jsonStringify } from '../../utils/encoding.js';

/**
 * Names the HTTP server span after the matched route, as
 * `@opentelemetry/instrumentation-express` did: OpenTelemetry has no AdonisJS
 * instrumentation, so without this every span would be named just `POST`.
 * Also records the request body when LOG_REQUEST_BODY=true, which the express
 * instrumentation's `requestHook` in nodejs-instrumentation does for Express.
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
