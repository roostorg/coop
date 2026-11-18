import {
  Catch,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import { type Response } from 'express';

import { type Dependencies } from '../iocContainer/index.js';
import { jsonStringify } from '../utils/encoding.js';
import {
  getErrorsFromAggregateError,
  makeNotFoundError,
  sanitizeError,
  type SerializableError,
} from '../utils/errors.js';
import { logErrorJson } from '../utils/logging.js';
import { safePick } from '../utils/misc.js';
import {
  isNonEmptyArray,
  type NonEmptyArray,
} from '../utils/typescript-types.js';
import { InjectDep } from './tokens.js';

/**
 * Serializes REST errors as `{ errors: [...] }` with the status of the first
 * error, and records them on a span. GraphQL errors are rethrown for Apollo's
 * `formatError`.
 */
@Catch()
export class CoopExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectDep('Tracer') private readonly tracer: Dependencies['Tracer'],
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<string>() !== 'http') {
      throw exception;
    }
    const res = host.switchToHttp().getResponse<Response>();

    // Nest raises NotFoundException for unmatched routes, and wraps 4xx errors
    // from Express middleware such as body-parser in an HttpException.
    const err =
      exception instanceof NotFoundException
        ? makeNotFoundError('Requested route not found.', {
            shouldErrorSpan: true,
          })
        : exception instanceof HttpException && exception.cause instanceof Error
          ? exception.cause
          : (exception as Error);

    // Nest does not await catch(), so it must not throw.
    try {
      await this.respond(err, res);
    } catch (e) {
      // eslint-disable-next-line no-restricted-syntax
      logErrorJson({ message: 'error handler failed', error: e });
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
  }

  private async respond(err: Error, res: Response) {
    await this.tracer.addActiveSpan(
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
          if (err instanceof AggregateError) {
            const extractedErrors = getErrorsFromAggregateError(err);
            return isNonEmptyArray(extractedErrors) ? extractedErrors : [err];
          }
          return [err];
        })() satisfies NonEmptyArray<unknown>;

        if (errors.length > 1 || errors[0] !== err) {
          span.setAttribute(
            'errors',
            jsonStringify(
              errors.map((it) => safePick(it, ['name', 'message', 'stack'])),
            ),
          );
        }

        // A handler that responded early (e.g. 202) and then failed in the
        // background can't change its status any more.
        if (!res.headersSent) {
          const safeErrors = errors.map((it) =>
            sanitizeError(it),
          ) satisfies SerializableError[] as NonEmptyArray<SerializableError>;
          res.status(safeErrors[0].status).json({ errors: safeErrors });
        }
      },
    );
  }
}
