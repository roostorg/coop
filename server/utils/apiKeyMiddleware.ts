import { type JsonObject, type JsonValue, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../iocContainer/index.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from './correlationIds.js';
import { ErrorType, CoopError } from './errors.js';
import { type RequestHandlerWithBodies } from './route-helpers.js';

/**
 * Request type that includes orgId property set by API key middleware
 */
export interface RequestWithOrgId {
  orgId: string;
}

/**
 * Middleware that validates API key and sets orgId on the request.
 * Returns 401 if API key is invalid or missing.
 */
export function createApiKeyMiddleware<
  ReqBody extends JsonObject = JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined = ReadonlyDeep<JsonValue> | undefined
>({
  ApiKeyService,
}: Pick<Dependencies, 'ApiKeyService'>): RequestHandlerWithBodies<ReqBody, ResBody> {
  return async (req, _res, next) => {
    const providedKey = req.header('x-api-key');
    let orgId: string | null;
    
    try {
      orgId = providedKey && !Array.isArray(providedKey) 
        ? await ApiKeyService.validateApiKey(providedKey) 
        : null;
    } catch (_error) {
      // If API key validation throws an error, treat it as invalid
      orgId = null;
    }

    if (!orgId) {
      // Invalid API key is a client-side error, so return a 400.
      const requestId = toCorrelationId({ 
        type: 'api-key-validation', 
        id: uuidv1() 
      });
      
      return next(new CoopError({
        status: 401,
        type: [ErrorType.Unauthorized],
        title: 'Invalid API Key',
        detail:
          'Something went wrong finding or validating your API key. ' +
          'Make sure the proper key is provided in the x-api-key header.',
        requestId: fromCorrelationId(requestId),
        name: 'UnauthorizedError',
        shouldErrorSpan: true,
      }));
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
  return typeof req === 'object' && req !== null && 'orgId' in req && typeof (req as { orgId: unknown }).orgId === 'string';
}
