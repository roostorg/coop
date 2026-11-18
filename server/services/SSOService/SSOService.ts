import { inject } from '../../iocContainer/utils.js';
import { type PrismaPgClient } from '../../storage/prisma/index.js';

export class SSOService {
  constructor(private readonly prisma: PrismaPgClient) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    // `users` has no relation to `org_settings` in the schema (no FK), so the
    // inner join becomes two lookups.
    const user = await this.prisma.users.findUniqueOrThrow({
      select: { org_id: true },
      where: { email },
    });
    const { org_id: orgId } = await this.prisma.org_settings.findFirstOrThrow({
      select: { org_id: true },
      where: { org_id: user.org_id, saml_enabled: true },
    });
    return `/api/v1/saml/login/${orgId}`;
  }
}

export default inject(['PrismaPg'], SSOService);
