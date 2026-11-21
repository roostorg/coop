import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  type PermissionGroup,
  type UserPermission,
  type UserRole,
} from '../../services/userManagementService/index.js';
import {
  kyselyGetPermissionGroups,
  kyselyListRolesForOrg,
  kyselyRenameRole,
  kyselyUpdateRolePermissions,
  type RoleParent,
} from './rolePersistence.js';

/**
 * GraphQL data source for the role-editor surface. Mirrors the existing
 * Api/Persistence split (see {@link UserAPI}/{@link kyselyUserFindById}):
 * the persistence module owns the Postgres queries; this class is the DI-wired
 * adapter resolvers reach for via `context.dataSources.roleAPI`.
 */
class RoleAPI {
  constructor(private readonly db: Dependencies['PrismaPg']) {}

  async listRolesForOrg(orgId: string): Promise<RoleParent[]> {
    return kyselyListRolesForOrg(this.db, orgId);
  }

  getPermissionGroups(): readonly PermissionGroup[] {
    return kyselyGetPermissionGroups();
  }

  async updateRolePermissions(opts: {
    orgId: string;
    roleKey: UserRole;
    permissions: readonly UserPermission[];
  }): Promise<RoleParent> {
    return kyselyUpdateRolePermissions(this.db, opts);
  }

  async renameRole(opts: {
    orgId: string;
    roleKey: UserRole;
    displayName: string;
    description?: string | null;
  }): Promise<RoleParent> {
    return kyselyRenameRole(this.db, opts);
  }
}

export default inject(['PrismaPg'], RoleAPI);
export type { RoleAPI };
