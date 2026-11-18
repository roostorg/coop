import { type IncomingMessage, type ServerResponse } from 'node:http';
import BodyParserMiddleware from '@adonisjs/core/bodyparser_middleware';
import {
  HttpContextFactory,
  RequestFactory,
  ServerFactory,
} from '@adonisjs/core/factories/http';
import { type HttpContext, type Router } from '@adonisjs/core/http';
import { type JsonObject } from 'type-fest';
import { type GenericSchema } from 'valibot';

import bodyparserConfig from '../config/bodyparser.js';
import { createBodySchemaValidator } from '../utils/bodySchemaValidation.js';

/**
 * A bare AdonisJS server (no app, providers or services) for tests of one
 * piece of the HTTP layer. Errors are rendered as the error object itself,
 * with its `status`.
 */
export async function makeBareServer(register: (router: Router) => void) {
  const server = new ServerFactory().create();
  const router = server.getRouter();
  const bodyParser = new BodyParserMiddleware(bodyparserConfig);
  router
    .group(() => register(router))
    .use(async (ctx, next) => bodyParser.handle(ctx, next));
  server.errorHandler(async () => ({
    default: class {
      report() {}
      handle(error: { status?: number }, ctx: HttpContext) {
        ctx.response.status(error.status ?? 500).json(error);
      }
    },
  }));
  await server.boot();
  return async (req: IncomingMessage, res: ServerResponse) => server.handle(req, res);
}

/**
 * A server with one POST route that validates its body against `schema` and
 * answers 204 when it's valid.
 */
export async function makeBodySchemaTestServer<ReqBody extends JsonObject>(
  path: string,
  schema: GenericSchema<ReqBody, unknown>,
) {
  return makeBareServer((router) => {
    router
      .post(path, ({ response }) => response.noContent())
      .use(createBodySchemaValidator(schema));
  });
}

/**
 * An HttpContext for calling a route handler directly, with an optional
 * `orgId` (as the API key middleware sets) and query string.
 */
export function makeHandlerContext(
  opts: { orgId?: string; url?: string; headers?: Record<string, string> } = {},
) {
  const request = new RequestFactory().merge({ url: opts.url ?? '/' }).create();
  for (const [key, value] of Object.entries(opts.headers ?? {})) {
    // eslint-disable-next-line functional/immutable-data -- test setup on a fresh request
    request.request.headers[key.toLowerCase()] = value;
  }
  const ctx = new HttpContextFactory().merge({ request }).create();
  if (opts.orgId !== undefined) {
    // eslint-disable-next-line functional/immutable-data -- what the API key middleware does
    ctx.orgId = opts.orgId;
  }
  return ctx;
}
