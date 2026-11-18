import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { type Request, type Response } from 'express';
import { print } from 'graphql';

import { manualReviewToolResolverClasses } from '../../graphql/modules/manualReviewTool.resolvers.js';
import resolvers, { type Context } from '../../graphql/resolvers.js';
import typeDefs from '../../graphql/schema.js';
import { makeGqlServices } from '../../graphql/services.js';
import { authSchemaWrapper } from '../../graphql/utils/authorization.js';
import { formatGraphQLError } from '../../graphql/utils/formatError.js';
import { buildPassportContext } from '../../graphql/utils/passportContext.js';
import { safeDepthLimit } from '../../graphql/utils/safeDepthLimit.js';
import { type Dependencies } from '../../iocContainer/index.js';
import { safeGetEnvInt } from '../../iocContainer/utils.js';
import { COOP_DEPS } from '../tokens.js';

/**
 * Schema-first GraphQL at /api/v1/graphql. The SDL is the existing one in
 * `graphql/schema.ts`; resolvers come from the existing resolver maps plus the
 * Nest resolver classes of the modules ported so far (MRT).
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [COOP_DEPS],
      useFactory: (deps: Dependencies): ApolloDriverConfig => ({
        path: '/graphql',
        useGlobalPrefix: true,
        typeDefs: print(typeDefs),
        resolvers,
        // Every root field requires a session user unless it has @publicResolver.
        transformSchema: (schema) =>
          mapSchema(schema, {
            [MapperKind.QUERY_ROOT_FIELD]: (fieldConfig, _f, _t, s) =>
              authSchemaWrapper(fieldConfig, s),
            [MapperKind.MUTATION_ROOT_FIELD]: (fieldConfig, _f, _t, s) =>
              authSchemaWrapper(fieldConfig, s),
          }),
        playground: false,
        plugins: [
          ...(process.env.NODE_ENV === 'production'
            ? [ApolloServerPluginLandingPageDisabled()]
            : []),
        ],
        validationRules: [
          safeDepthLimit(safeGetEnvInt('GRAPHQL_MAX_DEPTH', 10)),
        ],
        introspection: process.env.NODE_ENV !== 'production',
        formatError: formatGraphQLError,
        context: ({ req, res }: { req: Request; res: Response }): Context => ({
          ...buildPassportContext(req, res),
          services: makeGqlServices(deps),
          dataSources: deps.DataSources,
        }),
      }),
    }),
  ],
  providers: [...manualReviewToolResolverClasses],
})
export class CoopGraphqlModule {}
