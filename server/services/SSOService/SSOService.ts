import type { Kysely } from 'kysely';

import { inject } from '../../iocContainer/index.js';
import type { SSOServicePg } from './dbTypes.js';

export class SSOService {
  constructor(
    private readonly pgQuery: Kysely<SSOServicePg>,
    private readonly configService: { apiUrl: string; uiUrl: string },
  ) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    const { org_id: orgId, saml_enabled: samlEnabled } = await this.pgQuery
      .selectFrom('users')
      .innerJoin('org_settings', 'users.org_id', 'org_settings.org_id')
      .where('users.email', '=', email)
      .where((eb) =>
        eb.or([
          eb('org_settings.saml_enabled', '=', true),
          eb('org_settings.oidc_enabled', '=', true),
        ]),
      )
      .select(['users.org_id', 'org_settings.saml_enabled'])
      .executeTakeFirstOrThrow();

    if (samlEnabled) {
      return { url: `/api/v1/saml/login/${orgId}`, method: 'GET' as const };
    } else {
      return { url: `/api/v1/oidc/${orgId}/start`, method: 'POST' as const };
    }
  }

  getSSOSamlCallbackUrl(orgId: string): string {
    return `${this.configService.apiUrl}/api/v1/saml/login/${orgId}/callback`;
  }

  getSSOSamlIssuer(): string {
    return this.configService.uiUrl;
  }

  getSSOOidcCallbackUrl(orgId: string): string {
    return `${this.configService.apiUrl}/api/v1/oidc/${orgId}/callback`;
  }
}

export default inject(['KyselyPg', 'ConfigService'], SSOService);
