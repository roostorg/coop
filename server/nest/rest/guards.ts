import {
  createParamDecorator,
  Injectable,
  mixin,
  type CanActivate,
  type ExecutionContext,
  type Type,
} from '@nestjs/common';
import { type Request } from 'express';
import { v1 as uuidv1 } from 'uuid';
import { safeParse, type GenericSchema } from 'valibot';

import { type Dependencies } from '../../iocContainer/index.js';
import { formatValidationIssues } from '../../utils/bodySchemaValidation.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import {
  makeBadRequestError,
  makeServiceUnavailableError,
  makeUnauthenticatedError,
} from '../../utils/errors.js';
import { InjectDep } from '../tokens.js';

/**
 * Validates the request body against a Valibot schema.
 *
 * This is a guard rather than a pipe because Nest runs pipes after guards, and
 * the API answers an invalid body with 400 before it checks the API key. List
 * it before `ApiKeyGuard` in `@UseGuards()`.
 */
export function BodySchemaGuard(
  schema: GenericSchema<unknown, unknown>,
): Type<CanActivate> {
  @Injectable()
  class BodySchemaGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext) {
      const { body } = context.switchToHttp().getRequest<Request>();
      const result = safeParse(schema, body, { abortEarly: false });
      if (!result.success) {
        throw makeBadRequestError('Request body failed schema validation.', {
          shouldErrorSpan: false,
          ...formatValidationIssues(result.issues, schema, body),
        });
      }
      return true;
    }
  }
  return mixin(BodySchemaGuardMixin);
}

/**
 * Resolves the org from the `x-api-key` header. Rejects with 401 for a missing
 * or unknown key and 503 when the key could not be checked.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectDep('ApiKeyService')
    private readonly apiKeyService: Dependencies['ApiKeyService'],
    @InjectDep('Tracer') private readonly tracer: Dependencies['Tracer'],
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<Request & { orgId?: string }>();
    const providedKey = req.header('x-api-key');
    let orgId: string | null;
    try {
      orgId = providedKey
        ? await this.apiKeyService.validateApiKey(providedKey)
        : null;
    } catch (error) {
      if (error instanceof Error) {
        this.tracer.getActiveSpan()?.recordException(error);
      }
      throw makeServiceUnavailableError('Unable to validate API key', {
        detail:
          "Coop couldn't check your API key right now. This is a temporary " +
          'server-side problem, not a problem with your key; please retry.',
        requestId: fromCorrelationId(
          toCorrelationId({ type: 'api-key-validation', id: uuidv1() }),
        ),
        cause: error,
        shouldErrorSpan: true,
      });
    }

    if (!orgId) {
      throw makeUnauthenticatedError('Invalid API Key', {
        detail:
          'Something went wrong finding or validating your API key. ' +
          'Make sure the proper key is provided in the x-api-key header.',
        requestId: fromCorrelationId(
          toCorrelationId({ type: 'api-key-validation', id: uuidv1() }),
        ),
        shouldErrorSpan: true,
      });
    }
    req.orgId = orgId;
    return true;
  }
}

/** The org that `ApiKeyGuard` resolved for this request. */
export const OrgId = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ orgId: string }>().orgId,
);
