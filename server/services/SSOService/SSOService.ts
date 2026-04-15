import type { Kysely } from 'kysely';

import { inject } from '../../iocContainer/index.js';
import type { SSOServicePg } from './dbTypes.js';

export class SSOService {
  constructor(
    private readonly pgQuery: Kysely<SSOServicePg>,
    private readonly configService: { apiUrl: string },
  ) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    const { org_id: orgId, saml_enabled: samlEnabled } = await this.pgQuery
      .selectFrom('users')
      .innerJoin('org_settings', 'users.org_id', 'org_settings.org_id')
      .where('users.email', '=', email)
      .where((eb) => eb.or([
        eb('org_settings.saml_enabled', '=', true),
        eb('org_settings.oidc_enabled', '=', true),
      ]))
      .select(['users.org_id', 'org_settings.saml_enabled'])
      .executeTakeFirstOrThrow();

    if (samlEnabled) {
      return `/api/v1/saml/login/${orgId}`
    } else {
      return `${this.configService.apiUrl}/api/v1/oidc/login/${orgId}`;
    }
  }

  getSSOOidcCallbackUrl(): string {
    return `${this.configService.apiUrl}/api/v1/oidc/login/callback`;
  }
}

export default inject(['KyselyPg', 'ConfigService'], SSOService);
