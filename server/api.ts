/* eslint-disable max-lines */
import os from 'node:os';
import path from 'path';
import { ApolloServer } from '@apollo/server';
import { unwrapResolverError } from '@apollo/server/errors';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { expressMiddleware } from '@as-integrations/express5';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { MultiSamlStrategy } from '@node-saml/passport-saml';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  SEMATTRS_EXCEPTION_MESSAGE,
  SEMATTRS_EXCEPTION_STACKTRACE,
  SEMATTRS_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import depthLimit from 'graphql-depth-limit';
import { buildContext, GraphQLLocalStrategy } from 'graphql-passport';
import helmet from 'helmet';
import passport from 'passport';
import * as oidcClient from 'openid-client';

function normalizeIssuerUrl(raw: string): string {
  return `https://${raw.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}
import {
  makeLoginIncorrectPasswordError,
  makeLoginSsoRequiredError,
  makeLoginUserDoesNotExistError,
} from './graphql/datasources/UserApi.js';
import resolvers, { type Context } from './graphql/resolvers.js';
import typeDefs from './graphql/schema.js';
import { authSchemaWrapper } from './graphql/utils/authorization.js';
import { type Dependencies } from './iocContainer/index.js';
import { safeGetEnvInt } from './iocContainer/utils.js';
import controllers from './routes/index.js';
import { jsonStringify } from './utils/encoding.js';
import {
  ErrorType,
  getErrorsFromAggregateError,
  makeBadRequestError,
  makeInternalServerError,
  makeNotFoundError,
  sanitizeError,
  type SerializableError,
} from './utils/errors.js';
import { safePick } from './utils/misc.js';
import {
  isNonEmptyArray,
  type NonEmptyArray,
} from './utils/typescript-types.js';

function getCPUInfo() {
  const cpus = os.cpus();

  const total = cpus.reduce(
    (acc, cpu) =>
      acc +
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.irq +
      cpu.times.idle,
    0,
  );
  const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);

  return {
    idle,
    total,
  };
}

declare module "express-session" {
  interface SessionData {
    oidc: {
      code_verifier: string;
      state: string;
      org_id: string;
    };
  }
}


async function getCPUUsage() {
  const stats1 = getCPUInfo();
  const startIdle = stats1.idle;
  const startTotal = stats1.total;
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const stats2 = getCPUInfo();
  const endIdle = stats2.idle;
  const endTotal = stats2.total;
  return 1 - (endIdle - startIdle) / (endTotal - startTotal);
}

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const env = process.env.NODE_ENV || 'development';
const sessionStore = connectPgSimple(session);

export default async function makeApiServer(deps: Dependencies) {
  const app = express();
  const { User } = deps.Sequelize;

  app.use(cors());

  app.use(
    helmet(
      env === 'production'
        ? {}
        : {
            contentSecurityPolicy: {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
                connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http:'],
                fontSrc: ["'self'", 'data:', 'https:'],
                frameSrc: ["'self'"],
              },
            },
          },
    ),
  );
  app.use(express.json({ limit: '50mb' }));

  app.get('/ready', async (_req, res) => {
    const cpuUsage = await getCPUUsage();
    if (cpuUsage > 0.75) {
      return res.status(500).send('Unhealthy');
    }
    return res.status(200).send('Healthy');
  });

  /**
   * Passport & User Session Configuration
   */
  const {
    DATABASE_HOST,
    DATABASE_PORT = 5432,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = process.env;

  const connectionString = `postgres://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}`;

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: new sessionStore({ conString: connectionString }),
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
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        async getSamlOptions(req, done) {
          // orgId path param should be set in the /saml/* route handlers.
          const rawOrgId = req.params['orgId'];
          const orgId = typeof rawOrgId === 'string' ? rawOrgId : undefined;

          if (!orgId) {
            return done(
              makeNotFoundError('orgId not found in path.', {
                shouldErrorSpan: true,
              }),
            );
          }

          const samlSettings = await deps.OrgSettingsService.getSamlSettings(
            orgId,
          );

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
            // I could use UI_URL here but technically the API could be hosted
            // on a different domain in the future so hopefully this is more
            // robust, not that it will likely matter.
            callbackUrl: `${deps.ConfigService.uiUrl}/api/v1/saml/login/${orgId}/callback`,
            issuer: deps.ConfigService.uiUrl,
          });
        },
      },
      async (_req, profile, done) => {
        try {
          const user = await User.findOne({
            where: { email: String(profile?.email) },
          });
          // we should have already checked for this, but couldn't hurt to check
          // again
          if (user == null) {
            return done(
              makeLoginUserDoesNotExistError({ shouldErrorSpan: true }),
            );
          }

          return done(null, user as any);
        } catch (e) {
          return done(
            makeInternalServerError('Unknown error during login attempt', {
              shouldErrorSpan: true,
            }),
          );
        }
      },
      async (_req, profile, done) => {
        try {
          const user = await User.findOne({
            where: { email: String(profile?.email) },
          });
          // we should have already checked for this, but couldn't hurt to check
          // again
          if (user == null) {
            return done(
              makeLoginUserDoesNotExistError({ shouldErrorSpan: true }),
            );
          }

          return done(null, user as any);
        } catch (e) {
          return done(
            makeInternalServerError('Unknown error during login attempt', {
              shouldErrorSpan: true,
            }),
          );
        }
      },
    ),
  );

  app.get(
    '/saml/login/:orgId',
    passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
  );

  app.post(
    `/saml/login/:orgId/callback`,
    express.urlencoded(),
    passport.authenticate('saml', {
      failureRedirect: '/',
      failureFlash: true,
    }),
    (_req, res) => {
      res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
    },
  );

  app.get('/oidc/login/callback', async (req, res, next) => {
    if (req.query.error) {
      return res.redirect(`${deps.ConfigService.uiUrl}/login/sso?error=${req.query.error}`);
    }
    try {
      const sessionData = req.session['oidc'] as
        | { code_verifier: string; state?: string; org_id: string }
        | undefined;

      if (!sessionData || !sessionData.code_verifier || !sessionData.org_id) {
        return res.redirect('/');
      }

      const { code_verifier: codeVerifier, state, org_id: orgId } = sessionData;
      // Clear session OIDC state immediately (one-time use)
      delete req.session.oidc;

      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);
      if (!oidcSettings || !oidcSettings.client_id || !oidcSettings.client_secret || !oidcSettings.issuer_url) {
        return res.redirect('/');
      }

      const issuerUrl = normalizeIssuerUrl(oidcSettings.issuer_url);

      const { API_BASE_URL } = process.env;
      const config = await oidcClient.discovery(
        new URL(issuerUrl),
        oidcSettings.client_id,
        oidcSettings.client_secret,
        oidcClient.ClientSecretBasic(oidcSettings.client_secret),
      );

      // Reconstruct callback URL with code/state from IdP redirect.
      // authorizationCodeGrant needs: base = registered redirect_uri, query = code+state from IdP.
      const currentUrl = new URL(`${API_BASE_URL}/api/v1/oidc/login/callback`);
      for (const [k, v] of new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '')) {
        currentUrl.searchParams.set(k, v);
      }

      const checks: { pkceCodeVerifier: string; expectedState?: string } = { pkceCodeVerifier: codeVerifier };
      if (state) checks.expectedState = state;

      const tokens = await oidcClient.authorizationCodeGrant(config, currentUrl, checks);

      const claims = tokens.claims();
      let email: string | undefined = claims?.email as string | undefined;

      if (!email) {
        const userinfo = await oidcClient.fetchUserInfo(config, tokens.access_token, claims!.sub);
        email = userinfo.email;
      }

      if (!email) {
        return res.redirect('/');
      }

      const user = await User.findOne({ where: { email: String(email) } });

      if (!user || user.orgId !== orgId) {
        return res.redirect('/');
      }

      req.login(user as any, (err) => {
        if (err) return next(err);
        res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
      });
    } catch (e) {
      return res.redirect(`${deps.ConfigService.uiUrl}/login/sso?error=sso_login_failed`);
    }
  });

  app.get('/oidc/login/:orgId', async (req, res, next) => {
    try {
      const { orgId } = req.params;
      const oidcSettings = await deps.OrgSettingsService.getOidcSettings(orgId);
      
      if (!oidcSettings || oidcSettings.oidc_enabled !== true) {
        return next(makeBadRequestError('OIDC not enabled for this organization.', { shouldErrorSpan: true }));
      }
      if (!oidcSettings.client_id || !oidcSettings.client_secret || !oidcSettings.issuer_url) {
        return next(makeInternalServerError('Missing OIDC credentials for org.', { shouldErrorSpan: true }));
      }

      const { API_BASE_URL } = process.env;
      if (!API_BASE_URL) {
        return next(makeInternalServerError('API_BASE_URL not configured.', { shouldErrorSpan: true }));
      }
      const callbackUrl = deps.SSOService.getSSOOidcCallbackUrl();
      const issuerUrl = normalizeIssuerUrl(oidcSettings.issuer_url);
      
      const config = await oidcClient.discovery(
        new URL(issuerUrl),
        oidcSettings.client_id,
        oidcSettings.client_secret,
        oidcClient.ClientSecretBasic(oidcSettings.client_secret),
      );

      const codeVerifier = oidcClient.randomPKCECodeVerifier();
      const codeChallenge = await oidcClient.calculatePKCECodeChallenge(codeVerifier);

      const params: Record<string, string> = {
        redirect_uri: callbackUrl,
        scope: 'openid email',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      };

      const redirectTo = oidcClient.buildAuthorizationUrl(config, params);

      const state = oidcClient.randomState();
      redirectTo.searchParams.set('state', state);

      // Store PKCE data + orgId in session for callback
      req.session.oidc = { code_verifier: codeVerifier, state, org_id: orgId };

      res.redirect(redirectTo.href);
    } catch (e) {
      next(e);
    }
  });


  passport.use(
    new GraphQLLocalStrategy(async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email: String(email) } });
        if (user == null) {
          return done(
            makeLoginUserDoesNotExistError({ shouldErrorSpan: true }),
          );
        }
        const samlSettings = await deps.OrgSettingsService.getSamlSettings(
          user.orgId,
        );

        const oidcSettings = await deps.OrgSettingsService.getOidcSettings(
          user.orgId,
        );

        if (samlSettings?.saml_enabled === true || oidcSettings?.oidc_enabled === true) {
          return done(
            makeLoginSsoRequiredError({
              detail:
                'SSO is enabled for this organization. Password login is disabled.',
              shouldErrorSpan: true,
            }),
          );
        }

        if (!user.loginMethods.includes('password')) {
          return done(
            makeLoginIncorrectPasswordError({
              detail: 'Password is not set for user.',
              shouldErrorSpan: true,
            }),
          );
        }

        // if loginMethod is password, password should be set
        if (
          await User.passwordMatchesHash(
            String(password),
            user.password satisfies string | null as string,
          )
        ) {
          done(null, user);
        } else {
          done(makeLoginIncorrectPasswordError({ shouldErrorSpan: true }));
        }
      } catch (e) {
        deps.Tracer.logActiveSpanFailedIfAny(e);
        return done(
          makeInternalServerError('Unknown error during login attempt', {
            shouldErrorSpan: true,
          }),
        );
      }
    }),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    return User.findByPk(String(id), { rejectOnEmpty: true }).then((user) => {
      done(null, user);
    }, done);
  });

  /**
   * Apollo Server - uses /api/graphql path
   */
  const apolloServer = new ApolloServer<Context>({
    schema: mapSchema(makeExecutableSchema({ typeDefs, resolvers }), {
      [MapperKind.QUERY_ROOT_FIELD](
        fieldConfig,
        _fieldName,
        _typeName,
        schema,
      ) {
        return authSchemaWrapper(fieldConfig, schema);
      },
      [MapperKind.MUTATION_ROOT_FIELD](
        fieldConfig,
        _fieldName,
        _typeName,
        schema,
      ) {
        return authSchemaWrapper(fieldConfig, schema);
      },
    }),
    plugins: [
      ...(process.env.NODE_ENV === 'production'
        ? [ApolloServerPluginLandingPageDisabled()]
        : []),
    ],
    validationRules: [depthLimit(safeGetEnvInt('GRAPHQL_MAX_DEPTH', 10))],
    introspection: process.env.NODE_ENV !== 'production',
    formatError(formattedError, error) {
      // unwrapResolverError removes the GraphQLError wrapper added by graphql-js
      // when a non-GraphQL error is thrown from a resolver.
      const rawError = unwrapResolverError(error);

      // If the raw error is a GraphQLError (explicitly thrown by our code or
      // generated by graphql-js for parse/validation errors), the formattedError
      // is already correctly shaped -- pass it through.
      if (rawError instanceof GraphQLError) {
        return formattedError;
      }

      // For all other errors (CoopError, unexpected errors, context errors),
      // sanitize to remove sensitive details and reformat for the client.
      const sanitizedError = sanitizeError(
        rawError instanceof Error ? rawError : (error as Error),
      );
      const { title: sanitizedErrorTitle, ...extensions } = sanitizedError;

      const result: GraphQLFormattedError = {
        // When graphql-js wraps the resolver-thrown error in a GraphQLError,
        // it automatically tracks some metadata about where the error was thrown
        // from. That can be useful to clients, in a way that's a bit different
        // from our CoopError.pointer field; it tells them whether a null
        // value was return in the response because a given resolver failed, or
        // because the field's value is actually null. So, we pass this
        // metadata through as-is.
        locations: formattedError.locations,
        path: formattedError.path,
        // Apollo server also defines some predefined error codes that it could
        // be helpful for us to mimic on our custom errors (in case Apollo
        // clients handle them out of the box). The true, Coop-assigned code
        // for the error, though, will be in the `type` key, just like when
        // sending errors in REST responses (though, for GQL, this lives under
        // `extensions`).
        extensions: {
          ...extensions,
          code: extensions.type.includes(ErrorType.Unauthenticated)
            ? 'UNAUTHENTICATED'
            : extensions.type.includes(ErrorType.Unauthorized)
            ? 'FORBIDDEN'
            : extensions.type.includes(ErrorType.InvalidUserInput)
            ? 'BAD_USER_INPUT'
            : 'INTERNAL_SERVER_ERROR',
        },
        message: sanitizedErrorTitle,
      };
      return result;
    },
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => ({
        ...buildContext({ req, res }),
        services: makeGqlServices(deps),
        dataSources: deps.DataSources,
      } as unknown as Context),
    }),
  );

  Object.entries(controllers).forEach(([_k, controller]) => {
    controller.routes.forEach((it) => {
      const handler = it.handler(deps);
      app[it.method](
        path.join(controller.pathPrefix, it.path),
        ...(Array.isArray(handler) ? handler : [handler]),
      );
    });
  });

  // catch 404 and forward to error handler
  app.use(function (_req, _res, next) {
    next(
      makeNotFoundError('Requested route not found.', {
        shouldErrorSpan: true,
      }),
    );
  });

  // error handler
  app.use(async function (err, _req, res, _next) {
    await deps.Tracer.addActiveSpan(
      { resource: 'app', operation: 'handleError' },
      async (span) => {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

        // I don't know if these attributes are necessary, with recordException
        span.setAttribute(SEMATTRS_EXCEPTION_MESSAGE, err.message);
        if (err.stack) {
          span.setAttribute(SEMATTRS_EXCEPTION_STACKTRACE, err.stack);
        }
        span.setAttribute(SEMATTRS_EXCEPTION_TYPE, err.name);

        const errors = (() => {
          if (err instanceof AggregateError) {
            const extractedErrors = getErrorsFromAggregateError(err);
            return isNonEmptyArray(extractedErrors) ? extractedErrors : [err];
          } else {
            return [err];
          }
        })() satisfies NonEmptyArray<unknown>;

        // If we had any nested errors (from an AggregateError),
        // attach those to the span too.
        if (errors.length > 1 || errors[0] !== err) {
          span.setAttribute(
            'errors',
            jsonStringify(
              errors.map((it) => safePick(it, ['name', 'message', 'stack'])),
            ),
          );
        }

        // If we've already sent response headers or the response status code,
        // we can't actually send a different status code here: it's an error
        // in HTTP to send the headers portion of a response twice. So, we
        // need to skip this step.
        //
        // This can happen, e.g., if we have a request handler that
        // immediately responds with a 202/204 but then continues to do some
        // processing work in the background, and that work errors.
        if (!res.headersSent) {
          const safeErrors = errors.map((it) =>
            sanitizeError(it),
          ) satisfies SerializableError[] as NonEmptyArray<SerializableError>;

          res.status(pickStatus(safeErrors)).json({ errors: safeErrors });
        }
      },
    );
  } as ErrorRequestHandler);

  return {
    app,
    async shutdown() {
      await Promise.all([
        apolloServer.stop(),
        deps.closeSharedResourcesForShutdown(),
      ]);
    },
  };
}

function pickStatus(safeErrors: NonEmptyArray<SerializableError>) {
  return safeErrors[0].status;
}

function makeGqlServices(deps: Dependencies) {
  return {
    ...safePick(deps, [
      'ApiKeyService',
      'DataWarehouse',
      'DerivedFieldsService',
      'getItemTypeEventuallyConsistent',
      'getEnabledRulesForItemTypeEventuallyConsistent',
      'ItemInvestigationService',
      'ModerationConfigService',
      'ManualReviewToolService',
      'HMAHashBankService',
      'NcmecService',
      'OrgSettingsService',
      'PartialItemsService',
      'ReportingService',
      'RuleEvaluator',
      'Sequelize',
      'SignalsService',
      'SigningKeyPairService',
      'Tracer',
      'UserManagementService',
      'UserStatisticsService',
      'UserHistoryQueries',
      'UserStrikeService',
      'SSOService',
    ]),
    // Calling sendEmail straight from a resolver is hella sketch, as the
    // resolvers shouldn’t have real business logic in them. Future sendEmail
    // calls should be encapsulated inside some business-logic-containing
    // service, and it’s that service that should be called from the resolvers.
    legacy_DO_NOT_USE_DIRECTLY_sendEmail: deps.sendEmail,
  };
}

export type GQLServices = ReturnType<typeof makeGqlServices>;
