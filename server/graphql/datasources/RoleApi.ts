import { type Kysely } from 'kysely';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
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
 * the persistence module owns Kysely queries; this class is the DI-wired
 * adapter resolvers reach for via `context.dataSources.roleAPI`.
 */
class RoleAPI {
  private readonly db: Kysely<CombinedPg>;

  constructor(db: Dependencies['KyselyPg']) {
    this.db = db as Kysely<CombinedPg>;
  }

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

export default inject(['KyselyPg'], RoleAPI);
export type { RoleAPI };
