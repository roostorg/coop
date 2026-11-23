import { sql } from 'kysely';
import { uid } from 'uid';

import createOrg from '../fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../harness/transactionalTest.js';

// Released app versions (1.2.3 and earlier) run these queries against
// org_settings. Deployments migrate the database before upgrading the app and
// may roll the app back, so the schema must keep accepting them until no
// supported release issues them (see #1627).
describe('org_settings compatibility with released app versions (integration)', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const orgId = uid();
    await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      orgId,
    );
    return { orgId };
  });

  testWithFixture(
    'accepts the 1.2.3 settings-row insert and isDemoOrg read',
    async ({ deps, orgId }) => {
      const db = deps.KyselyPg;
      await db
        .deleteFrom('public.org_settings')
        .where('org_id', '=', orgId)
        .execute();

      await sql`
        INSERT INTO public.org_settings (
          org_id, has_reporting_rules_enabled, has_appeals_enabled,
          allow_multiple_policies_per_action, user_strike_ttl_days, is_demo_org,
          saml_enabled, sso_url, cert, appeal_callback_url,
          appeal_callback_headers, appeal_callback_body
        )
        VALUES (
          ${orgId}, false, false, false, 90, false, false,
          null, null, null, null, null
        )
        ON CONFLICT (org_id) DO NOTHING
      `.execute(db);

      const { rows } = await sql<{ is_demo_org: boolean }>`
        SELECT is_demo_org FROM public.org_settings WHERE org_id = ${orgId}
      `.execute(db);
      expect(rows).toEqual([{ is_demo_org: false }]);
    },
  );
});
