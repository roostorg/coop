import { errors as httpErrors, type HttpContext } from '@adonisjs/core/http';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';

import { resolve } from '../../adonis/resolve.js';
import { jsonStringify } from '../../utils/encoding.js';
import {
  getErrorsFromAggregateError,
  makeNotFoundError,
  sanitizeError,
  type SerializableError,
} from '../../utils/errors.js';
import { safePick } from '../../utils/misc.js';
import {
  isNonEmptyArray,
  type NonEmptyArray,
} from '../../utils/typescript-types.js';

/**
 * Serializes every error as Coop's `{ errors: [...] }` JSON body and records it
 * on the request's span.
 *
 * This is a plain error handler, not a subclass of AdonisJS'
 * `ExceptionHandler`: that one renders HTML/JSON:API pages, status pages and
 * framework error codes (`E_ROUTE_NOT_FOUND`), none of which Coop's clients
 * expect.
 */
export default class HttpExceptionHandler {
  report() {}

  async handle(error: unknown, ctx: HttpContext): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));

    if (error instanceof httpErrors.E_ROUTE_NOT_FOUND) {
      const url = ctx.request.url();
      if (!url.startsWith('/api/v1/') && url !== '/api/v1') {
        // Outside `/api/v1`, Express answered with its default finalhandler
        // page, not Coop's JSON error.
        return expressDefaultNotFound(ctx);
      }
      return this.handle(
        makeNotFoundError('Requested route not found.', {
          shouldErrorSpan: true,
        }),
        ctx,
      );
    }

    const tracer = await resolve(ctx, 'Tracer');
    await tracer.addActiveSpan(
      { resource: 'app', operation: 'handleError' },
      async (span) => {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.setAttribute(ATTR_EXCEPTION_MESSAGE, err.message);
        if (err.stack) {
          span.setAttribute(ATTR_EXCEPTION_STACKTRACE, err.stack);
        }
        span.setAttribute(ATTR_EXCEPTION_TYPE, err.name);

        const errors = (() => {
          if (error instanceof AggregateError) {
            const extractedErrors = getErrorsFromAggregateError(error);
            return isNonEmptyArray(extractedErrors) ? extractedErrors : [error];
          } else {
            return [error];
          }
        })() satisfies NonEmptyArray<unknown>;

        if (errors.length > 1 || errors[0] !== error) {
          span.setAttribute(
            'errors',
            jsonStringify(
              errors.map((it) =>
                safePick(it as Error, ['name', 'message', 'stack']),
              ),
            ),
          );
        }

        // A handler that already flushed its response (e.g. a 202 followed by
        // background work, see `ctx.response.finish()`) can still throw; the
        // status can't be sent twice.
        if (ctx.response.headersSent) {
          return;
        }

        const safeErrors = errors.map((it) =>
          sanitizeError(it),
        ) satisfies SerializableError[] as NonEmptyArray<SerializableError>;

        ctx.response.status(safeErrors[0].status).json({ errors: safeErrors });
      },
    );
  }
}

function expressDefaultNotFound(ctx: HttpContext) {
  const method = ctx.request.method();
  const path = ctx.request.url();
  const body =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<title>Error</title>\n</head>\n<body>\n' +
    `<pre>Cannot ${escapeHtml(method)} ${escapeHtml(path)}</pre>\n` +
    '</body>\n</html>\n';
  ctx.response
    .status(404)
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Content-Security-Policy', "default-src 'none'")
    .header('X-Content-Type-Options', 'nosniff')
    .send(body);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
