import type { Kysely } from 'kysely';

import { inject } from '../../iocContainer/index.js';
import type { SSOServicePg } from './dbTypes.js';

export class SSOService {
  constructor(private readonly pgQuery: Kysely<SSOServicePg>) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    const { org_id: orgId } = await this.pgQuery
      .selectFrom('users')
      .innerJoin('org_settings', 'users.org_id', 'org_settings.org_id')
      .where('users.email', '=', email)
      .where('org_settings.saml_enabled', '=', true)
      .select('users.org_id')
      .executeTakeFirstOrThrow();
    return `/api/v1/saml/login/${orgId}`;
  }
}

export default inject(['KyselyPg'], SSOService);
