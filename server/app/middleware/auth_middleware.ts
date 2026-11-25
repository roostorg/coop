import type { Authenticators } from '@adonisjs/auth/types';
import type { HttpContext } from '@adonisjs/core/http';
import type { NextFn } from '@adonisjs/core/types/http';

/**
 * Authenticates the request with the given guard (the default if none).
 *
 * Not `ctx.auth.authenticateUsing()`: it calls each guard's `check()`, so a
 * failed key lookup (503) would become a 401, and it replaces the guard's
 * error with a generic `E_UNAUTHORIZED_ACCESS`.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guard?: keyof Authenticators } = {},
  ) {
    await ctx.auth.use(options.guard).authenticate();
    return next();
  }
}
