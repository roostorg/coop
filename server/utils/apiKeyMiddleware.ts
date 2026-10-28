import { type Request } from 'express';
import { type JsonObject, type JsonValue, type ReadonlyDeep } from 'type-fest';
import { v1 as uuidv1 } from 'uuid';

import { type Dependencies } from '../iocContainer/index.js';
import { type ApiKeyPermission } from '../services/apiKeyService/index.js';
import { fromCorrelationId, toCorrelationId } from './correlationIds.js';
import { makeUnauthenticatedError, makeUnauthorizedError } from './errors.js';
import { type RequestHandlerWithBodies } from './route-helpers.js';

/**
 * Request type that includes orgId property set by API key middleware
 */
export interface RequestWithOrgId {
  orgId: string;
}

/**
 * Middleware that validates API key and sets orgId on the request.
 * Returns 401 for invalid keys and 403 for missing permissions.
 */
export function createApiKeyMiddleware<
  ReqBody extends JsonObject = JsonObject,
  ResBody extends ReadonlyDeep<JsonValue> | undefined =
    ReadonlyDeep<JsonValue> | undefined,
>(
  { ApiKeyService }: Pick<Dependencies, 'ApiKeyService'>,
  requiredPermissions:
    | readonly ApiKeyPermission[]
    | ((req: Pick<Request, 'originalUrl'>) => readonly ApiKeyPermission[]),
): RequestHandlerWithBodies<ReqBody, ResBody> {
  return async (req, _res, next) => {
    const providedKey = req.header('x-api-key');
    let key: Awaited<ReturnType<typeof ApiKeyService.validateApiKey>>;

    try {
      key =
        providedKey && !Array.isArray(providedKey)
          ? await ApiKeyService.validateApiKey(providedKey)
          : null;
    } catch (_error) {
      // If API key validation throws an error, treat it as invalid
      key = null;
    }

    if (!key) {
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

    const required =
      typeof requiredPermissions === 'function'
        ? requiredPermissions(req)
        : requiredPermissions;
    if (required.some((permission) => !key.permissions.includes(permission))) {
      return next(
        makeUnauthorizedError('API key lacks required permissions', {
          detail: `Required permissions: ${required.join(', ')}`,
          shouldErrorSpan: true,
        }),
      );
    }

    // Store orgId on the request for use by route handlers
    (req as unknown as RequestWithOrgId).orgId = key.orgId;
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
