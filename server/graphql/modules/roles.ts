import {
  UserPermission,
  UserRole,
} from '../../services/userManagementService/index.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import { type Context } from '../resolvers.js';
import {
  forbiddenError,
  unauthenticatedError,
  userInputError,
} from '../utils/errors.js';

const typeDefs = /* GraphQL */ `
  type Role {
    "Persisted public.roles.id, or null when the row is materialized lazily on first save."
    id: ID
    "Stable role identifier (matches UserRole)."
    key: UserRole!
    displayName: String!
    description: String
    isSystem: Boolean!
    permissions: [UserPermission!]!
    "True when permissions/metadata come from the static fallback rather than public.roles."
    isFallback: Boolean!
    "Number of approved (non-rejected) users in the org assigned to this role."
    userCount: Int!
  }

  type PermissionGroupItem {
    permission: UserPermission!
    label: String!
    description: String!
  }

  type PermissionGroup {
    key: String!
    label: String!
    description: String!
    permissions: [PermissionGroupItem!]!
  }

  input UpdateRolePermissionsInput {
    roleKey: UserRole!
    permissions: [UserPermission!]!
  }

  input RenameRoleInput {
    roleKey: UserRole!
    displayName: String!
    description: String
  }

  type Query {
    "All system roles for the invoking admin's org. Gated on MANAGE_ROLES."
    rolesForOrg: [Role!]!
    "Server-owned grouping + ordering for the role-editor UI. Gated on MANAGE_ROLES."
    permissionGroups: [PermissionGroup!]!
  }

  type Mutation {
    updateRolePermissions(input: UpdateRolePermissionsInput!): Role!
    renameRole(input: RenameRoleInput!): Role!
  }
`;

const Query: GQLQueryResolvers = {
  async rolesForOrg(_, __, context) {
    const user = requireRoleVisibility(context);
    return context.dataSources.roleAPI.listRolesForOrg(user.orgId);
  },
  async permissionGroups(_, __, context) {
    requireManageRoles(context);
    return context.dataSources.roleAPI.getPermissionGroups();
  },
};

const Mutation: GQLMutationResolvers = {
  async updateRolePermissions(_, params, context) {
    const user = requireManageRoles(context);
    const { roleKey, permissions } = params.input;
    assertKnownRole(roleKey);
    const sanitized = assertKnownPermissions(permissions);
    return context.dataSources.roleAPI.updateRolePermissions({
      orgId: user.orgId,
      roleKey,
      permissions: sanitized,
    });
  },
  async renameRole(_, params, context) {
    const user = requireManageRoles(context);
    const { roleKey, displayName, description } = params.input;
    assertKnownRole(roleKey);
    assertNonEmptyDisplayName(displayName);
    return context.dataSources.roleAPI.renameRole({
      orgId: user.orgId,
      roleKey,
      displayName: displayName.trim(),
      description: description ?? null,
    });
  },
};

function requireManageRoles(context: Context) {
  const user = context.getUser();
  if (user == null) {
    throw unauthenticatedError('Authenticated user required');
  }
  if (!user.getPermissions().includes(UserPermission.MANAGE_ROLES)) {
    throw forbiddenError(
      'User does not have permission to manage roles in this organization',
    );
  }
  return user;
}

function requireRoleVisibility(context: Context) {
  const user = context.getUser();
  if (user == null) {
    throw unauthenticatedError('Authenticated user required');
  }
  const perms = user.getPermissions();
  if (
    !perms.includes(UserPermission.MANAGE_ROLES) &&
    !perms.includes(UserPermission.MANAGE_USERS)
  ) {
    throw forbiddenError(
      'User does not have permission to view roles in this organization',
    );
  }
  return user;
}

function assertKnownRole(roleKey: string): asserts roleKey is UserRole {
  if (!Object.values(UserRole).includes(roleKey)) {
    throw userInputError(`Unknown role: ${roleKey}`);
  }
}

function assertKnownPermissions(
  permissions: readonly string[],
): UserPermission[] {
  const known = new Set(Object.values(UserPermission));
  const sanitized: UserPermission[] = [];
  for (const p of permissions) {
    if (!known.has(p)) {
      throw userInputError(`Unknown permission: ${p}`);
    }
    sanitized.push(p as UserPermission);
  }
  return sanitized;
}

function assertNonEmptyDisplayName(displayName: string) {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    throw userInputError('displayName must not be empty');
  }
  if (trimmed.length > 255) {
    throw userInputError('displayName must be at most 255 characters');
  }
}

const resolvers = {
  Query,
  Mutation,
};

export { typeDefs, resolvers };
