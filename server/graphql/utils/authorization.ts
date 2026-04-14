import { getDirective } from '@graphql-tools/utils';
import {
  defaultFieldResolver,
  type GraphQLFieldConfig,
  type GraphQLResolveInfo,
  type GraphQLSchema,
} from 'graphql';

import type { Context } from '../resolvers.js';

import { unauthenticatedError } from './errors.js';

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
            throw unauthenticatedError('No user in context.');
          }
          return originalResolver(source, args, context, info);
        },
  };
}
