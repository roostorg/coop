import { CoopError, ErrorType, makeNotFoundError } from './errors.js';

/**
 * Express and body-parser reject malformed requests with plain errors that
 * carry a 4xx `status`: http-errors (from body-parser) set `expose: true`, and
 * the router throws a URIError for an undecodable path param. `res.sendFile`
 * also reports a missing file as an exposed 404. Convert those to CoopErrors
 * so `sanitizeError` keeps their status and the documented body shape instead
 * of reporting a 500. Any other value is returned unchanged.
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

  // http-errors only sets `expose` when its message is meant for the client.
  const detail = expose === true ? err.message : undefined;
  const data = { cause: err, detail, shouldErrorSpan: false };
  if (status === 404) {
    return makeNotFoundError('Not found.', data);
  }
  return new CoopError({
    ...data,
    status,
    type: [ErrorType.InvalidUserInput],
    title:
      status === 413
        ? 'Request body too large.'
        : err instanceof URIError
          ? 'Malformed URL.'
          : type === 'entity.parse.failed'
            ? 'Malformed JSON body.'
            : 'Invalid request.',
    name: status === 413 ? 'PayloadTooLargeError' : 'BadRequestError',
  });
}
