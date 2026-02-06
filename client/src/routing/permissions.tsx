import { gql } from '@apollo/client';

import { GQLUserPermission } from '../graphql/generated';

gql`
  query PermissionGatedRouteLoggedInUser {
    me {
      id
      permissions
    }
  }
`;

export function userHasPermissions(
  userPermissions: readonly GQLUserPermission[] | undefined,
  requiredPermissions: readonly GQLUserPermission[],
) {
  return (
    userPermissions != null &&
    requiredPermissions.every((it) => userPermissions.includes(it))
  );
}
