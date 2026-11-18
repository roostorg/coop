import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { type Dependencies } from './iocContainer/index.js';
import { AppModule } from './nest/app.module.js';
import {
  makeSessionMiddleware,
  PASSPORT,
  SESSION_STORE,
} from './nest/auth/auth.module.js';
import { CoopNestLogger } from './nest/coopLogger.js';

// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
const env = process.env.NODE_ENV || 'development';

/**
 * Builds the NestJS app and returns its underlying Express instance, so
 * `bin/www.ts` and the supertest harnesses use it as before.
 */
export default async function makeWWWServer(deps: Dependencies) {
  const app = express();

  // Traffic is routed to our app via: NLB -> ALB -> Express. The
  // NLB terminates TLS, so the NLB -> ALB request is over HTTP. As a
  // result, when the ALB hits express, it sets the `x-forwarded-proto` header
  // to `http`. This causes express to think the request is insecure, which
  // cause express-session to refuse to send a session cookie (since we mark our
  // session cookies with the `Secure` flag, which is designed to prevent both
  // server and client from sending the cookie in plaintext over HTTP).
  // express-session intentionally does not have a way to force it to skip the
  // secure check and unconditionally send the session cookie (see
  // https://github.com/expressjs/session/issues/785), so we have two options:
  //
  // 1. Override `req.secure` to always return true, so express-session thinks
  //    the request is secure.
  //
  // 2. Actually have the request hit the ALB over HTTPS, which involves either
  //    having the NLB re-encrypt the traffic on the way to the ALB, or having
  //    the NLB re-encrypt it and pass that through.
  //
  // Option 2 is more complex, so we go with option 1 for now. However, the risk
  // with option 1 is that different code/middleware will check different things
  // to determine whether the request is secure, and those checks disagreeing
  // could lead to subtle bugs. So, we limit that risk by patching as many
  // things as possible (i.e, also `req.protocol` and `x-forwarded-proto`); we
  // don't deal with the `Forwarded` header since that's more complicated and
  // less widely supported, so less likely to be checked by middleware.
  //
  // Note: forcing the ALB to set `x-forwarded-proto` to `https` is not an
  // option, as AWS doesn't support that.
  app.set('trust proxy', true);
  app.use((req, _res, next) => {
    // Define our overrides as getter properties to be consistent with their
    // definition in express, just in case.
    Object.defineProperty(req, 'secure', { get: () => true });
    Object.defineProperty(req, 'protocol', { get: () => 'https' });
    // NB: we overwrite the x-forwarded-proto, rather than append to it with a
    // comma, because x-forwarded-proto is a non-standardized header with no spec,
    // and it's not clear if appending is actually kosher/universally supported.
    req.headers['x-forwarded-proto'] = 'https';
    next();
  });

  const nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(deps),
    new ExpressAdapter(app),
    // Nest's own body parser defaults to a 100kb limit; Coop accepts 50mb.
    { bodyParser: false, logger: new CoopNestLogger(), abortOnError: false },
  );
  nestApp.setGlobalPrefix('api/v1');

  // Express middleware, in the order the API has always applied it. It runs
  // before every Nest route (registered by init() below).
  nestApp.use(cors());
  nestApp.use(
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
  nestApp.use(express.json({ limit: '50mb' }));
  // The health check stays outside the session, as it was before.
  const sessionMiddleware = makeSessionMiddleware(
    nestApp.get(SESSION_STORE),
    nestApp.get(PASSPORT),
  );
  for (const middleware of sessionMiddleware) {
    const skipHealthCheck: express.RequestHandler = (req, res, next) =>
      req.path === '/api/v1/ready' ? next() : middleware(req, res, next);
    // Keep the inner middleware's name (session, initialize, authenticate):
    // OpenTelemetry's Express instrumentation names spans after it.
    Object.defineProperty(skipHealthCheck, 'name', { value: middleware.name });
    nestApp.use(skipHealthCheck);
  }

  await nestApp.init();

  return {
    app,
    async shutdown() {
      // Closes Apollo and the session store (AuthModule.onApplicationShutdown).
      await Promise.all([
        nestApp.close(),
        deps.closeSharedResourcesForShutdown(),
      ]);
    },
  };
}
