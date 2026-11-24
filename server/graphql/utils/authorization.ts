import { getDirective } from '@graphql-tools/utils';
import {
  defaultFieldResolver,
  type GraphQLFieldConfig,
  type GraphQLResolveInfo,
  type GraphQLSchema,
} from 'graphql';

import { UserPermission } from '../../services/userManagementService/index.js';
import { type GraphQLUserParent } from '../datasources/userKyselyPersistence.js';
import type { Context } from '../resolvers.js';
import { forbiddenError, unauthenticatedError } from './errors.js';

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

export function requireChildSafetyPermission(
  user: GraphQLUserParent | null | undefined,
): GraphQLUserParent {
  if (!user) {
    throw unauthenticatedError('User required.');
  }
  if (!user.getPermissions().includes(UserPermission.VIEW_CHILD_SAFETY_DATA)) {
    throw forbiddenError(
      'VIEW_CHILD_SAFETY_DATA permission required to view NCMEC data.',
    );
  }
  return user;
}

export function hasPermission(
  user: GraphQLUserParent | null | undefined,
  permission: UserPermission,
): boolean {
  return user?.getPermissions().includes(permission) ?? false;
}

export function requirePermission(
  user: GraphQLUserParent | null | undefined,
  permission: UserPermission,
): GraphQLUserParent {
  if (!user) {
    throw unauthenticatedError('User required.');
  }
  if (!hasPermission(user, permission)) {
    throw forbiddenError(`${permission} permission required.`);
  }
  return user;
}

/**
 * Creating, updating or deleting a rule that is or becomes live requires
 * MUTATE_LIVE_RULES. Any other rule mutation requires MUTATE_LIVE_RULES or
 * MUTATE_NON_LIVE_RULES. `touchesLiveRule` is only called when the user lacks
 * MUTATE_LIVE_RULES, so it can look the rule up in the user's org.
 */
export async function requireRuleMutationPermission(
  user: GraphQLUserParent | null | undefined,
  touchesLiveRule: (orgId: string) => boolean | Promise<boolean>,
): Promise<GraphQLUserParent> {
  if (!user) {
    throw unauthenticatedError('User required.');
  }
  if (hasPermission(user, UserPermission.MUTATE_LIVE_RULES)) {
    return user;
  }
  if (await touchesLiveRule(user.orgId)) {
    throw forbiddenError(
      'MUTATE_LIVE_RULES permission required to change live rules.',
    );
  }
  if (!hasPermission(user, UserPermission.MUTATE_NON_LIVE_RULES)) {
    throw forbiddenError('MUTATE_NON_LIVE_RULES permission required.');
  }
  return user;
}
