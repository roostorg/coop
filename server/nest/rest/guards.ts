import {
  createParamDecorator,
  Injectable,
  mixin,
  type CanActivate,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import { type Request, type RequestHandler, type Response } from 'express';
import { type JsonObject } from 'type-fest';
import { type GenericSchema } from 'valibot';

import { type Dependencies } from '../../iocContainer/index.js';
import { createApiKeyMiddleware } from '../../utils/apiKeyMiddleware.js';
import { createBodySchemaValidator } from '../../utils/bodySchemaValidation.js';
import { InjectDep } from '../tokens.js';

/**
 * Runs an Express middleware as a guard: `next()` allows the request and
 * `next(err)` throws the error for CoopExceptionFilter. The REST guards wrap
 * the middleware the Express routes use, so both share one implementation.
 */
async function runMiddlewareAsGuard(
  middleware: RequestHandler,
  context: ExecutionContext,
): Promise<true> {
  const http = context.switchToHttp();
  return new Promise((resolve, reject) => {
    const next = (err?: unknown) => (err ? reject(err) : resolve(true));
    Promise.resolve(
      middleware(
        http.getRequest<Request>(),
        http.getResponse<Response>(),
        next,
      ),
    ).catch(reject);
  });
}

/**
 * Validates the request body against a Valibot schema.
 *
 * This is a guard rather than a pipe because Nest runs pipes after guards, and
 * the API answers an invalid body with 400 before it checks the API key. List
 * it before `ApiKeyGuard` in `@UseGuards()`.
 */
export function BodySchemaGuard(
  schema: GenericSchema<JsonObject, unknown>,
): Type<CanActivate> {
  const validate = createBodySchemaValidator(schema);

  @Injectable()
  class BodySchemaGuardMixin implements CanActivate {
    async canActivate(context: ExecutionContext) {
      return runMiddlewareAsGuard(validate, context);
    }
  }
  return mixin(BodySchemaGuardMixin);
}

/**
 * Resolves the org from the `x-api-key` header and stores it on the request.
 * Rejects with 401 for a missing or unknown key and 503 when the key could not
 * be checked.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly middleware: RequestHandler;

  constructor(
    @InjectDep('ApiKeyService')
    apiKeyService: Dependencies['ApiKeyService'],
    @InjectDep('Tracer') tracer: Dependencies['Tracer'],
  ) {
    this.middleware = createApiKeyMiddleware({
      ApiKeyService: apiKeyService,
      Tracer: tracer,
    }) as RequestHandler;
  }

  async canActivate(context: ExecutionContext) {
    return runMiddlewareAsGuard(this.middleware, context);
  }
}

/** The org that `ApiKeyGuard` resolved for this request. */
export const OrgId = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ orgId: string }>().orgId,
);
