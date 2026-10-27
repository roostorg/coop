import { type JsonObject, type JsonValue, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../iocContainer/index.js';
import { fromCorrelationId, toCorrelationId } from './correlationIds.js';
import {
  makeServiceUnavailableError,
  makeUnauthenticatedError,
} from './errors.js';
import { type RequestHandlerWithBodies } from './route-helpers.js';

/**
 * Request type that includes orgId property set by API key middleware
 */
export interface RequestWithOrgId {
  orgId: string;
}

const API_KEY_VALIDATION_RETRY_AFTER_SECONDS = '5';

/**
 * Middleware that validates API key and sets orgId on the request.
 * Returns 401 if API key is invalid or missing, and 503 if the key couldn't be
 * checked (e.g. the database is unreachable) -- a lookup failure says nothing
 * about whether the caller's key is valid.
 */
export function createApiKeyMiddleware<
  ReqBody extends JsonObject = JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined =
    ReadonlyDeep<JsonValue> | undefined,
>({
  ApiKeyService,
  Tracer,
}: Pick<Dependencies, 'ApiKeyService' | 'Tracer'>): RequestHandlerWithBodies<
  ReqBody,
  ResBody
> {
  return async (req, res, next) => {
    const providedKey = req.header('x-api-key');
    let orgId: string | null;

    try {
      orgId =
        providedKey && !Array.isArray(providedKey)
          ? await ApiKeyService.validateApiKey(providedKey)
          : null;
    } catch (error) {
      // validateApiKey returns null for an unknown/inactive key and only
      // throws when the lookup itself failed. The error handler records only
      // the 503 below on its span, so record the database error here. The
      // active span belongs to the caller, so its status is left unchanged.
      if (error instanceof Error) {
        Tracer.getActiveSpan()?.recordException(error);
      }
      const requestId = toCorrelationId({
        type: 'api-key-validation',
        id: uuidv1(),
      });
      res.setHeader('Retry-After', API_KEY_VALIDATION_RETRY_AFTER_SECONDS);
      return next(
        makeServiceUnavailableError('Unable to validate API key', {
          detail:
            "Coop couldn't check your API key right now. This is a temporary " +
            'server-side problem, not a problem with your key; please retry.',
          requestId: fromCorrelationId(requestId),
          // Kept for server-side logging; never serialized to the client.
          cause: error,
          shouldErrorSpan: true,
        }),
      );
    }

    if (!orgId) {
      const requestId = toCorrelationId({
        type: 'api-key-validation',
        id: uuidv1(),
      });

      return next(
        makeUnauthenticatedError('Invalid API Key', {
          detail:
            'Something went wrong finding or validating your API key. ' +
            'Make sure the proper key is provided in the x-api-key header.',
          requestId: fromCorrelationId(requestId),
          shouldErrorSpan: true,
        }),
      );
    }

    // Store orgId on the request for use by route handlers
    (req as unknown as RequestWithOrgId).orgId = orgId;
    next();
  };
}

/**
 * Type guard to check if request has orgId set by the API key middleware
 */
export function hasOrgId(req: unknown): req is RequestWithOrgId {
  return (
    typeof req === 'object' &&
    req !== null &&
    'orgId' in req &&
    typeof req.orgId === 'string'
  );
}
