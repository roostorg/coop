import { symbols } from '@adonisjs/auth';
import type { AuthClientResponse, GuardContract } from '@adonisjs/auth/types';
import type { HttpContext } from '@adonisjs/core/http';
import { v1 as uuidv1 } from 'uuid';

import { resolve } from '../../adonis/resolve.js';
import {
  fromCorrelationId,
  toCorrelationId,
} from '../../utils/correlationIds.js';
import {
  CoopError,
  makeServiceUnavailableError,
  makeUnauthenticatedError,
} from '../../utils/errors.js';

export type ApiKeyPrincipal = { orgId: string };

/**
 * An `@adonisjs/auth` guard for Coop's `x-api-key` header. AdonisJS' own
 * access-token guard reads `Authorization: Bearer` tokens from a Lucid-backed
 * table, so it can't validate the keys integrators already hold; this guard
 * wraps `ApiKeyService` instead.
 */
export class ApiKeyGuard implements GuardContract<ApiKeyPrincipal> {
  declare [symbols.GUARD_KNOWN_EVENTS]: Record<string, never>;
  readonly driverName = 'coop_api_key';
  authenticationAttempted = false;
  isAuthenticated = false;
  user?: ApiKeyPrincipal;

  constructor(private readonly ctx: HttpContext) {}

  async authenticate() {
    if (this.authenticationAttempted) return this.getUserOrFail();
    this.authenticationAttempted = true;

    const ApiKeyService = await resolve(this.ctx, 'ApiKeyService');
    const key = this.ctx.request.header('x-api-key');
    let orgId: string | null;
    try {
      orgId = key ? await ApiKeyService.validateApiKey(key) : null;
    } catch (error) {
      // A failed lookup says nothing about the key: 503, not 401.
      const Tracer = await resolve(this.ctx, 'Tracer');
      if (error instanceof Error)
        Tracer.getActiveSpan()?.recordException(error);
      throw makeServiceUnavailableError('Unable to validate API key', {
        detail:
          "Coop couldn't check your API key right now. This is a temporary " +
          'server-side problem, not a problem with your key; please retry.',
        requestId: newRequestId(),
        cause: error,
        shouldErrorSpan: true,
      });
    }
    if (!orgId) throw invalidKeyError();

    this.user = { orgId };
    this.isAuthenticated = true;
    return this.user;
  }

  /** False for a missing or invalid key; a failed lookup still throws. */
  async check() {
    try {
      await this.authenticate();
      return true;
    } catch (error) {
      if (error instanceof CoopError && error.status === 401) return false;
      throw error;
    }
  }

  getUserOrFail() {
    if (!this.user) throw invalidKeyError();
    return this.user;
  }

  async authenticateAsClient(
    user: ApiKeyPrincipal,
  ): Promise<AuthClientResponse> {
    throw new Error(
      `Test clients send a real x-api-key for org ${user.orgId} instead.`,
    );
  }
}

function newRequestId() {
  return fromCorrelationId(
    toCorrelationId({ type: 'api-key-validation', id: uuidv1() }),
  );
}

function invalidKeyError() {
  return makeUnauthenticatedError('Invalid API Key', {
    detail:
      'Something went wrong finding or validating your API key. ' +
      'Make sure the proper key is provided in the x-api-key header.',
    requestId: newRequestId(),
    shouldErrorSpan: true,
  });
}
