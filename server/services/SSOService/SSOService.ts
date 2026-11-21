import { inject } from '../../iocContainer/utils.js';
import { managerOf, type TypeormDb } from '../../storage/typeorm/db.js';
import { OrgSettings, Users } from '../../storage/typeorm/entities/index.js';

export class SSOService {
  constructor(private readonly db: TypeormDb) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    const manager = await managerOf(this.db);
    // No relation is declared between users and org_settings (they share
    // org_id but neither references the other), so the join is spelled out.
    const row = await manager
      .createQueryBuilder(Users, 'users')
      .innerJoin(
        OrgSettings,
        'org_settings',
        'users.org_id = org_settings.org_id',
      )
      .where('users.email = :email', { email })
      .andWhere('org_settings.saml_enabled = true')
      .select('users.org_id', 'org_id')
      .getRawOne<{ org_id: string }>();
    // Same message as Kysely's executeTakeFirstOrThrow, which this replaces.
    if (row === undefined) {
      throw new Error('no result');
    }
    return `/api/v1/saml/login/${row.org_id}`;
  }
}

export default inject(['TypeormPg'], SSOService);
