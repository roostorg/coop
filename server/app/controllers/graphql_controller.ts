import { type HttpContext } from '@adonisjs/core/http';
import { HeaderMap } from '@apollo/server';

import { resolve } from '../../adonis/resolve.js';
import { makeGqlServices } from '../../graphql/services.js';
import { buildPassportContext } from '../../graphql/utils/passportContext.js';
import { bridgeRequest } from '../middleware/session_bridge_middleware.js';

/**
 * Apollo has no AdonisJS integration, so this is one: it hands the request to
 * `executeHTTPGraphQLRequest` and copies the result onto the AdonisJS
 * response, as `@as-integrations/express5` did for Express.
 */
export default class GraphqlController {
  async handle(ctx: HttpContext) {
    const apollo = await resolve(ctx, 'coop.apollo');
    const deps = await resolve(ctx, 'coop.deps');
    const { req, res } = bridgeRequest(ctx);

    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(ctx.request.headers())) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const result = await apollo.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: ctx.request.method().toUpperCase(),
        headers,
        search: ctx.request.parsedUrl.search ?? '',
        body: ctx.request.body(),
      },
      context: async () => ({
        ...buildPassportContext(req, res),
        services: makeGqlServices(deps),
        dataSources: deps.DataSources,
      }),
    });

    for (const [key, value] of result.headers) {
      ctx.response.header(key, value);
    }
    ctx.response.status(result.status ?? 200);

    if (result.body.kind === 'complete') {
      ctx.response.send(result.body.string);
      return;
    }

    // Incremental delivery (@defer/@stream): write chunks as they come.
    ctx.response.writeHead(result.status ?? 200);
    for await (const chunk of result.body.asyncIterator) {
      res.write(chunk);
    }
    res.end();
  }
}
