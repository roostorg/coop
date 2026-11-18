import { type HttpContext } from '@adonisjs/core/http';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../iocContainer/index.js';
import { fromCorrelationId, toCorrelationId } from './correlationIds.js';
import {
  makeServiceUnavailableError,
  makeUnauthenticatedError,
} from './errors.js';
import { type RouteMiddleware } from './route-helpers.js';

/**
 * Request type that includes orgId property set by API key middleware
 */
export interface RequestWithOrgId {
  orgId: string;
}

/**
 * Middleware that validates API key and sets orgId on the request.
 * Returns 401 if API key is invalid or missing, and 503 if the key couldn't be
 * checked (e.g. the database is unreachable) -- a lookup failure says nothing
 * about whether the caller's key is valid.
 */
export function createApiKeyMiddleware({
  ApiKeyService,
  Tracer,
}: Pick<Dependencies, 'ApiKeyService' | 'Tracer'>): RouteMiddleware {
  return async (ctx, next) => {
    const providedKey = ctx.request.header('x-api-key');
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
      throw makeServiceUnavailableError('Unable to validate API key', {
        detail:
          "Coop couldn't check your API key right now. This is a temporary " +
          'server-side problem, not a problem with your key; please retry.',
        requestId: fromCorrelationId(requestId),
        // Kept for server-side logging; never serialized to the client.
        cause: error,
        shouldErrorSpan: true,
      });
    }

    if (!orgId) {
      const requestId = toCorrelationId({
        type: 'api-key-validation',
        id: uuidv1(),
      });

      throw makeUnauthenticatedError('Invalid API Key', {
        detail:
          'Something went wrong finding or validating your API key. ' +
          'Make sure the proper key is provided in the x-api-key header.',
        requestId: fromCorrelationId(requestId),
        shouldErrorSpan: true,
      });
    }

    // Store orgId on the context for use by route handlers
    ctx.orgId = orgId;
    return next();
  };
}

/**
 * Type guard to check if the API key middleware set an orgId on the context
 */
export function hasOrgId(
  ctx: HttpContext,
): ctx is HttpContext & RequestWithOrgId {
  return typeof ctx.orgId === 'string';
}
