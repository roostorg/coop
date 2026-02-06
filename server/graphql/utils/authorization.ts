import { getDirective } from '@graphql-tools/utils';
import { AuthenticationError } from 'apollo-server-express';
import {
  defaultFieldResolver,
  type GraphQLFieldConfig,
  type GraphQLResolveInfo,
  type GraphQLSchema,
} from 'graphql';

import type { Context } from '../resolvers.js';

export function shouldSkipAuth(
  schema: GraphQLSchema,
  fieldConfig: GraphQLFieldConfig<unknown, unknown>,
): boolean {
  const directives = getDirective(schema, fieldConfig, 'publicResolver');

  return directives ? directives.length > 0 : false;
}

export function authSchemaWrapper(
  fieldConfig: GraphQLFieldConfig<unknown, unknown>,
  schema: GraphQLSchema,
) {
  const originalResolver = fieldConfig.resolve ?? defaultFieldResolver;
  return {
    ...fieldConfig,
    resolve: shouldSkipAuth(schema, fieldConfig)
      ? originalResolver
      : async function (
          source: unknown,
          args: unknown,
          context: Context,
          info: GraphQLResolveInfo,
        ) {
          if (!context.getUser()) {
            throw new AuthenticationError('No user in context.');
          }
          return originalResolver(source, args, context, info);
        },
  };
}
