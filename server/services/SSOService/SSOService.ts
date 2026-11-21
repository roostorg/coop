import { and, eq } from 'drizzle-orm';

import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';

export class SSOService {
  constructor(private readonly db: CoopDb) {}

  // Throws is SSO is not enabled for an org
  async getSSORedirectUrlForUserEmail(email: string) {
    const { users, orgSettings } = schema;
    const row = (
      await this.db
        .select({ orgId: users.orgId })
        .from(users)
        .innerJoin(orgSettings, eq(users.orgId, orgSettings.orgId))
        .where(and(eq(users.email, email), eq(orgSettings.samlEnabled, true)))
        .limit(1)
    ).at(0);
    if (row === undefined) {
      // Same message as Kysely's NoResultError, which this used to throw.
      throw new Error('no result');
    }
    return `/api/v1/saml/login/${row.orgId}`;
  }
}

export default inject(['DrizzlePg'], SSOService);
