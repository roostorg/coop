import {
  Controller,
  Get,
  Inject,
  Module,
  Post,
  RequestMethod,
  Res,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  MultiSamlStrategy,
  type Profile,
  type VerifiedCallback,
} from '@node-saml/passport-saml';
import connectPgSimple from 'connect-pg-simple';
import express, { type Request, type Response } from 'express';
import session from 'express-session';
import { Passport } from 'passport';

import { kyselyUserFindById } from '../../graphql/datasources/userKyselyPersistence.js';
import { getOrgIdFromPath } from '../../graphql/utils/orgIdFromPath.js';
import { resolveSamlUser } from '../../graphql/utils/resolveSamlUser.js';
import { type Dependencies } from '../../iocContainer/index.js';
import {
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
} from '../../utils/errors.js';
import { COOP_DEPS, InjectDeps } from '../tokens.js';

type PassportInstance = InstanceType<typeof Passport>;

export const PASSPORT = Symbol('PASSPORT');
export const SESSION_STORE = Symbol('SESSION_STORE');

const PgSessionStore = connectPgSimple(session);
type SessionStore = InstanceType<typeof PgSessionStore>;

function makePassport(deps: Dependencies) {
  const passport = new Passport();
  const { KyselyPg } = deps;

  // Shared signon/logout verify: bind the user lookup to the org named in the
  // callback path so an assertion authenticating one org can never resolve a
  // user from another (GHSA-2v93-383c-9fw2).
  const verify = async (
    req: Request,
    profile: Profile | null,
    done: VerifiedCallback,
  ) => resolveSamlUser(KyselyPg, deps.Tracer, req, profile, done);

  passport.use(
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        async getSamlOptions(req, done) {
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
          if (!samlSettings) {
            return done(
              makeInternalServerError('Unexpected error.', {
                shouldErrorSpan: true,
              }),
            );
          }
          if (!samlSettings.saml_enabled) {
            return done(
              makeBadRequestError('SAML not enabled for this organization.', {
                shouldErrorSpan: true,
              }),
            );
          }
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

  return passport;
}

/**
 * Session cookie middleware, then passport. Applied globally in
 * `makeWWWServer` (before Nest's router) so GraphQL, REST and the bridged
 * Express routes all see `req.user`.
 */
export function makeSessionMiddleware(
  store: SessionStore,
  passport: PassportInstance,
) {
  return [
    session({
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
    }),
    passport.initialize(),
    passport.session(),
  ];
}

@Controller('saml/login/:orgId')
class SamlController {
  constructor(@InjectDeps() private readonly deps: Dependencies) {}

  // Never reached: passport redirects to the IdP in the middleware.
  @Get()
  login() {}

  @Post('callback')
  callback(@Res() res: Response) {
    res.redirect(`${this.deps.ConfigService.uiUrl}/dashboard`);
  }
}

@Module({
  controllers: [SamlController],
  providers: [
    {
      provide: PASSPORT,
      useFactory: makePassport,
      inject: [COOP_DEPS],
    },
    {
      provide: SESSION_STORE,
      useFactory: (deps: Dependencies) =>
        new PgSessionStore({ pool: deps.KyselyPgPool }),
      inject: [COOP_DEPS],
    },
  ],
  exports: [PASSPORT, SESSION_STORE],
})
export class AuthModule implements NestModule, OnApplicationShutdown {
  constructor(
    @Inject(PASSPORT) private readonly passport: PassportInstance,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStore,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    const authenticate = this.passport.authenticate('saml', {
      failureRedirect: '/',
      failureFlash: true,
    });
    consumer
      .apply(authenticate)
      .forRoutes({ path: 'saml/login/:orgId', method: RequestMethod.GET });
    consumer.apply(express.urlencoded(), authenticate).forRoutes({
      path: 'saml/login/:orgId/callback',
      method: RequestMethod.POST,
    });
  }

  async onApplicationShutdown() {
    await this.sessionStore.close();
  }
}
