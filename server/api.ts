/* eslint-disable max-lines */
// In this case, we want to rely on apollo-server-express bundling a
// corresponding version of apollo-server-core, rather than picking an
// apollo-server-core version in package.json
// eslint-disable-next-line import/no-extraneous-dependencies
import os from 'node:os';
import path from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  SEMATTRS_EXCEPTION_MESSAGE,
  SEMATTRS_EXCEPTION_STACKTRACE,
  SEMATTRS_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import {
  ApolloError,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import { buildContext, GraphQLLocalStrategy } from 'graphql-passport';
import helmet from 'helmet';
import passport from 'passport';
import { MultiSamlStrategy } from '@node-saml/passport-saml';

import {
  makeLoginIncorrectPasswordError,
  makeLoginSsoRequiredError,
  makeLoginUserDoesNotExistError,
} from './graphql/datasources/UserApi.js';
import resolvers from './graphql/resolvers.js';
import typeDefs from './graphql/schema.js';
import { authSchemaWrapper } from './graphql/utils/authorization.js';
import { type Dependencies } from './iocContainer/index.js';
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

  app.use(helmet(env === 'production' ? {} : { contentSecurityPolicy: false }));
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
          // orgId path param should be set in the /saml/* route handlers
          const orgId = req.params['orgId'];

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
    bodyParser.urlencoded({ extended: false }),
    passport.authenticate('saml', {
      failureRedirect: '/',
      failureFlash: true,
    }),
    (_req, res) => {
      res.redirect(`${deps.ConfigService.uiUrl}/dashboard`);
    },
  );

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

        if (
          samlSettings?.saml_enabled &&
          // We allow Coop users to log in with email/password even if SSO is
          // enabled
          // so Coop employees can manage user accounts
          String(email).split('@')[1] !== 'getcoop.com'
        ) {
          return done(
            makeLoginSsoRequiredError({
              detail:
                'SAML is enabled for this organization. Password login is disabled.',
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
  const apolloServer = new ApolloServer({
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
    dataSources: () => deps.DataSources,
    context: ({ req, res }) => {
      return {
        ...buildContext({ req, res }),
        services: makeGqlServices(deps),
      };
    },
    plugins: [
      {
        ...(process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageDisabled()
          : ApolloServerPluginLandingPageGraphQLPlayground()),
      },
    ],
    introspection: process.env.NODE_ENV !== 'production',
    formatError(e) {
      // `e` can be an ApolloError instance, but will only be one if such an
      // instance (or an ApolloError subclass) was explicitly thrown from a
      // resolver. In that case, we assume the thrower knows they're dealing
      // with apollo, and we can just pass the error through as-is.
      if (e instanceof ApolloError) {
        return e;
      }

      // In almost all other cases, the error will be an instance of the
      // `GraphQLError` class, which apollo instantiates automatically, and uses
      // to wrap any non-ApolloError error thrown from a resolver. However,
      // ocassionally -- e.g., if an error occurs during context creation rather
      // than in the resolver -- the error doesn't get wrapped (or it's wrapped
      // but with no originalError), so we handle both cases. Once we have the
      // underlying error that was actually thrown, we sanitize it to remove
      // sensitive details, and then try to format it in the most informative
      // way possible.
      const sanitizedError = sanitizeError(e.originalError ?? e);
      const { title: sanitizedErrorTitle, ...extensions } = sanitizedError;

      return {
        // When apollo-server wraps the resolver-thrown error in a GraphQLError,
        // it automatically tracks some metadata about where the error was thrown
        // from. That can be useful to clients, in a way that's a bit different
        // from our CoopError.pointer field; it tells them whether a null
        // value was return in the response because a given resolver failed, or
        // because the field's value is actually null. So, we pass this
        // apollo-annotated metdata through as-is.
        locations: e.locations,
        path: e.path,
        // Apollo server also defines some predefined error codes that it could
        // be helpful for us to mimic on our custom errors (in case Apollo
        // clients handle them out of the box). The true, Coop-assigned code
        // for the error, though, will be in the `type` key, just like when
        // sending errors in REST responses (though, for GQL, this lives under
        // `extensions`).
        code: extensions.type.includes(ErrorType.Unauthenticated)
          ? 'UNAUTHENTICATED'
          : extensions.type.includes(ErrorType.Unauthorized)
          ? 'FORBIDDEN'
          : extensions.type.includes(ErrorType.InvalidUserInput)
          ? 'BAD_USER_INPUT'
          : 'INTERNAL_SERVER_ERROR',
        // Then, this is info from the sanitized verion of the actual thrown error.
        message: sanitizedErrorTitle,
        extensions,
      };
    },
  });

  await apolloServer.start().then(() => {
    apolloServer.applyMiddleware({ app });
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
  });

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
