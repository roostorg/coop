import { CoopError, ErrorType } from './errors.js';

/**
 * Express and body-parser reject malformed requests with plain errors that
 * carry a 4xx `status`: http-errors (from body-parser) set `expose: true`, and
 * the router throws a URIError for an undecodable path param. Convert those to
 * CoopErrors so `sanitizeError` keeps their status and the documented body
 * shape instead of reporting a 500. Any other value is returned unchanged.
 */
export function toCoopErrorIfClientRequestError(err: unknown): unknown {
  if (!(err instanceof Error) || err instanceof CoopError) {
    return err;
  }
  const { status, expose, type } = err as Error & {
    status?: unknown;
    expose?: unknown;
    type?: unknown;
  };
  if (
    typeof status !== 'number' ||
    status < 400 ||
    status > 499 ||
    (expose !== true && !(err instanceof URIError))
  ) {
    return err;
  }

  const [name, title] =
    status === 413
      ? (['PayloadTooLargeError', 'Request body too large.'] as const)
      : err instanceof URIError
        ? (['BadRequestError', 'Malformed URL.'] as const)
        : type === 'entity.parse.failed'
          ? (['BadRequestError', 'Malformed JSON body.'] as const)
          : (['BadRequestError', 'Invalid request.'] as const);

  return new CoopError({
    cause: err,
    shouldErrorSpan: false,
    status,
    type: [ErrorType.InvalidUserInput],
    title,
    name,
  });
}
