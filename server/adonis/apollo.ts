import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';

import resolvers, { type Context } from '../graphql/resolvers.js';
import typeDefs from '../graphql/schema.js';
import { authSchemaWrapper } from '../graphql/utils/authorization.js';
import { formatGraphQLError } from '../graphql/utils/formatError.js';
import { safeDepthLimit } from '../graphql/utils/safeDepthLimit.js';
import { safeGetEnvInt } from '../iocContainer/utils.js';

/**
 * The Apollo server, configured exactly as in the Express app: same SDL and
 * resolvers, root fields wrapped with the authorization check, depth limit,
 * error formatting, and no landing page or introspection in production.
 */
export async function makeApolloServer() {
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
  return apolloServer;
}
