import { type Request, type Response } from 'express';

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
  req: Request;
  res: Response;
  getUser: () => GraphQLUserParent | undefined;
  login: (user: GraphQLUserParent) => Promise<void>;
  logout: () => Promise<void>;
};

/**
 * Build the passport-flavored slice of the Apollo resolver context.
 *
 * - `getUser()` reads `req.user`, populated by passport's session middleware
 *   via `passport.deserializeUser` (wired in `server/api.ts`).
 * - `login` / `logout` promisify the standard `req.login` / `req.logout` calls
 *   that `app.use(passport.session())` attaches to every request.
 */
export function buildPassportContext(
  req: Request,
  res: Response,
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
