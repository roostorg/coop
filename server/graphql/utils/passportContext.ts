import { type ServerResponse } from 'node:http';

import { type BridgedRequest } from '../../app/middleware/session_bridge_middleware.js';
import { type GraphQLUserParent } from '../datasources/userKyselyPersistence.js';

/**
 * Context fields that mimic the subset of `graphql-passport`'s `PassportContext`
 * that Coop actually uses (getUser/login/logout, plus `req`/`res`).
 *
 * The package itself was unmaintained and pulled in the deprecated
 * `subscriptions-transport-ws` as an optional peer; since Coop doesn't use
 * GraphQL subscriptions, we replicate the small surface area we need here.
 */
export type PassportGqlContext = {
  req: BridgedRequest;
  res: ServerResponse;
  getUser: () => GraphQLUserParent | undefined;
  login: (user: GraphQLUserParent) => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * Build the passport-flavored slice of the Apollo resolver context.
 *
 * - `getUser()` reads `req.user`, populated by passport's session middleware
 *   via `passport.deserializeUser` (wired in
 *   `app/middleware/session_bridge_middleware.ts`).
 * - `login` / `logout` promisify the standard `req.login` / `req.logout` calls
 *   that `passport.initialize()` attaches to every request (run by
 *   `app/middleware/session_bridge_middleware.ts`).
 */
export function buildPassportContext(
  req: BridgedRequest,
  res: ServerResponse,
): PassportGqlContext {
  return {
    req,
    res,
    getUser: () => req.user as GraphQLUserParent | undefined,
    login: async (user) =>
      new Promise<void>((resolve, reject) => {
        req.login(user, (err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            resolve();
          }
        });
      }),
    logout: async () =>
      new Promise<void>((resolve, reject) => {
        req.logout((err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            resolve();
          }
        });
      }),
  };
}
