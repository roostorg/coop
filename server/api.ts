import path from 'path';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { expressMiddleware } from '@as-integrations/express5';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import {
  MultiSamlStrategy,
  type Profile,
  type VerifiedCallback,
} from '@node-saml/passport-saml';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Request } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { Passport } from 'passport';

import { kyselyUserFindById } from './graphql/datasources/userKyselyPersistence.js';
import resolvers, { type Context } from './graphql/resolvers.js';
import typeDefs from './graphql/schema.js';
import { makeGqlServices } from './graphql/services.js';
import { authSchemaWrapper } from './graphql/utils/authorization.js';
import { formatGraphQLError } from './graphql/utils/formatError.js';
import { getOrgIdFromPath } from './graphql/utils/orgIdFromPath.js';
import { buildPassportContext } from './graphql/utils/passportContext.js';
import { resolveSamlUser } from './graphql/utils/resolveSamlUser.js';
import { safeDepthLimit } from './graphql/utils/safeDepthLimit.js';
import { type Dependencies } from './iocContainer/index.js';
import { safeGetEnvInt } from './iocContainer/utils.js';
import controllers from './routes/index.js';
import { createBodySchemaValidator } from './utils/bodySchemaValidation.js';
import { jsonStringify } from './utils/encoding.js';
import {
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

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const env = process.env.NODE_ENV || 'development';
const sessionStore = connectPgSimple(session);

export default async function makeApiServer(deps: Dependencies) {
  const app = express();
  const passport = new Passport();
  const { KyselyPg, KyselyPgPool } = deps;

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
    // TODO: Decide if we want to check for database connectivity here,
    // or if services need to fail gracefully.
    return res.status(200).send('Healthy');
  });

  /**
   * Passport & User Session Configuration
   */
  const sessionStoreInstance = new sessionStore({ pool: KyselyPgPool });
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStoreInstance,
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
            // I could use UI_URL here but technically the API could be hosted
            // on a different domain in the future so hopefully this is more
            // robust, not that it will likely matter.
            callbackUrl: `${deps.ConfigService.uiUrl}/api/v1/saml/login/${orgId}/callback`,
            issuer: deps.ConfigService.uiUrl,
          });
        },
      },
      verify,
      verify,
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

  /**
   * Apollo Server - uses /api/graphql path
   */
  const apolloServer = new ApolloServer<Context>({
    schema: mapSchema(makeExecutableSchema<Context>({ typeDefs, resolvers }), {
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
    validationRules: [safeDepthLimit(safeGetEnvInt('GRAPHQL_MAX_DEPTH', 10))],
    introspection: process.env.NODE_ENV !== 'production',
    formatError: formatGraphQLError,
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => ({
        ...buildPassportContext(req, res),
        services: makeGqlServices(deps),
        dataSources: deps.DataSources,
      }),
    }),
  );

  Object.entries(controllers).forEach(([_k, controller]) => {
    controller.routes.forEach((it) => {
      const handler = it.handler(deps);
      const handlers = Array.isArray(handler) ? handler : [handler];
      // If the route declares a bodySchema, validate the request body against
      // it before any handler runs. Routes without a schema (e.g., GETs) skip
      // validation entirely.
      const middlewares = it.bodySchema
        ? [createBodySchemaValidator(it.bodySchema), ...handlers]
        : handlers;
      app[it.method](path.join(controller.pathPrefix, it.path), ...middlewares);
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
        span.setAttribute(ATTR_EXCEPTION_MESSAGE, err.message);
        if (err.stack) {
          span.setAttribute(ATTR_EXCEPTION_STACKTRACE, err.stack);
        }
        span.setAttribute(ATTR_EXCEPTION_TYPE, err.name);

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
        sessionStoreInstance.close(),
      ]);
    },
  };
}

function pickStatus(safeErrors: NonEmptyArray<SerializableError>) {
  return safeErrors[0].status;
}
