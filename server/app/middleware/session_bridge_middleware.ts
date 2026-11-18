import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type HttpContext } from '@adonisjs/core/http';
import { type NextFn } from '@adonisjs/core/types/http';
import {
  MultiSamlStrategy,
  type Profile,
  type VerifiedCallback,
} from '@node-saml/passport-saml';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Passport } from 'passport';

import { resolve } from '../../adonis/resolve.js';
import { kyselyUserFindById } from '../../graphql/datasources/userKyselyPersistence.js';
import { getOrgIdFromPath } from '../../graphql/utils/orgIdFromPath.js';
import { resolveSamlUser } from '../../graphql/utils/resolveSamlUser.js';
import { type Dependencies } from '../../iocContainer/index.js';
import {
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
} from '../../utils/errors.js';

/**
 * The Node request as the Connect-style auth middleware sees it: AdonisJS'
 * parsed params, query and body copied on, plus what express-session and
 * passport attach (`session`, `sessionID`, `user`, `login`, `logout`).
 */
export type BridgedRequest = IncomingMessage & {
  params: Record<string, string | undefined>;
  query: Record<string, unknown>;
  body: unknown;
  originalUrl: string;
  user?: Express.User;
  sessionID?: string;
  session?: session.Session;
  login(user: Express.User, done: (err: unknown) => void): void;
  logout(done: (err: unknown) => void): void;
};

type BridgedResponse = ServerResponse & {
  redirect?: (url: string) => void;
};

type ConnectMiddleware = (
  req: BridgedRequest,
  res: BridgedResponse,
  next: (err?: unknown) => void,
) => unknown;

export type AuthStack = {
  passport: InstanceType<typeof Passport>;
  middleware: ConnectMiddleware[];
  close(): Promise<void>;
};

const PgSessionStore = connectPgSimple(session);

/**
 * Sessions and SAML stay on express-session, connect-pg-simple and passport,
 * run inside AdonisJS by this bridge. Moving to `@adonisjs/session` and
 * `@adonisjs/auth` would change the cookie (`connect.sid`, signed with
 * SESSION_SECRET by cookie-signature) and the `session` table format, logging
 * every user out at deploy; passport-saml has no AdonisJS equivalent.
 */
export function makeAuthStack(deps: Dependencies): AuthStack {
  const { KyselyPg, KyselyPgPool } = deps;
  const passport = new Passport();
  const store = new PgSessionStore({ pool: KyselyPgPool });

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET!,
    store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      // 30 Days in milliseconds
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
    resave: false,
    saveUninitialized: false,
    proxy: true,
  });

  // Shared signon/logout verify: bind the user lookup to the org named in the
  // callback path so an assertion authenticating one org can never resolve a
  // user from another (GHSA-2v93-383c-9fw2).
  const verify = async (
    req: unknown,
    profile: Profile | null,
    done: VerifiedCallback,
  ) =>
    resolveSamlUser(
      KyselyPg,
      deps.Tracer,
      req as BridgedRequest,
      profile,
      done,
    );

  passport.use(
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        async getSamlOptions(req, done) {
          // orgId path param should be set in the /saml/* route handlers.
          const orgId = getOrgIdFromPath(req);

          if (!orgId) {
            return done(
              makeNotFoundError('orgId not found in path.', {
                shouldErrorSpan: true,
              }),
            );
          }

          const samlSettings =
            await deps.OrgSettingsService.getSamlSettings(orgId);

          if (!samlSettings)
            return done(
              makeInternalServerError('Unexpected error.', {
                shouldErrorSpan: true,
              }),
            );

          if (!samlSettings.saml_enabled)
            return done(
              makeBadRequestError('SAML not enabled for this organization.', {
                shouldErrorSpan: true,
              }),
            );

          done(null, {
            entryPoint: samlSettings.sso_url as string,
            idpCert: samlSettings.cert as string,
            callbackUrl: `${deps.ConfigService.uiUrl}/api/v1/saml/login/${orgId}/callback`,
            issuer: deps.ConfigService.uiUrl,
          });
        },
      },
      verify,
      verify,
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await kyselyUserFindById(KyselyPg, String(id));
      if (user == null) {
        return done(
          makeNotFoundError(`Session user ${String(id)} not found`, {
            shouldErrorSpan: true,
          }),
        );
      }
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  });

  return {
    passport,
    middleware: [
      sessionMiddleware as unknown as ConnectMiddleware,
      passport.initialize() as unknown as ConnectMiddleware,
      passport.session(),
    ],
    async close() {
      await Promise.resolve(store.close());
    },
  };
}

/**
 * Copies what Connect-style middleware expects onto the raw Node request and
 * response: route params, query, parsed body, `originalUrl`, and Express'
 * `res.redirect` (passport calls it for `failureRedirect`).
 */
export function bridgeRequest(ctx: HttpContext): {
  req: BridgedRequest;
  res: BridgedResponse;
} {
  const req = ctx.request.request as BridgedRequest;
  req.params = ctx.params;
  req.query = ctx.request.qs();
  req.body = ctx.request.body();
  req.originalUrl = ctx.request.url(true);

  const res = ctx.response.response as BridgedResponse;
  res.redirect ??= (url: string) => {
    const body = `Found. Redirecting to ${url}`;
    res.statusCode = 302;
    res.setHeader('Location', url);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
  };
  return { req, res };
}

/**
 * Runs one Connect-style middleware. Resolves `true` when it calls `next()`,
 * `false` when it ends the response itself (e.g. a passport redirect), and
 * rejects when it calls `next(err)`.
 */
export async function runConnectMiddleware(
  middleware: ConnectMiddleware,
  req: BridgedRequest,
  res: BridgedResponse,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const onFinish = () => resolve(false);
    res.once('finish', onFinish);
    try {
      middleware(req, res, (err?: unknown) => {
        res.off('finish', onFinish);
        if (err != null) {
          reject(err instanceof Error ? err : (err as Error));
        } else {
          resolve(true);
        }
      });
    } catch (e) {
      res.off('finish', onFinish);
      reject(e);
    }
  });
}

/** The user passport deserialized from the session cookie, if any. */
export function getSessionUser(ctx: HttpContext): Express.User | undefined {
  return (ctx.request.request as Partial<BridgedRequest>).user;
}

/**
 * Loads the session and the session user (express-session, then
 * `passport.initialize()` and `passport.session()`), as the Express app did
 * for every `/api/v1` route except `/ready`.
 */
export default class SessionBridgeMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const auth = await resolve(ctx, 'coop.auth');
    const { req, res } = bridgeRequest(ctx);
    for (const middleware of auth.middleware) {
      if (!(await runConnectMiddleware(middleware, req, res))) {
        return;
      }
    }
    return next();
  }
}
