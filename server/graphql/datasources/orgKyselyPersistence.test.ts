import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import {
  kyselyOrgDeleteById,
  kyselyOrgFindByEmail,
  kyselyOrgFindById,
  kyselyOrgFindByName,
  kyselyOrgInsert,
  kyselyOrgUpdate,
} from './orgKyselyPersistence.js';

describe('orgKyselyPersistence', () => {
  const testWithFixture = makeTestWithFixture(async () => {
    const { deps, shutdown } = await makeMockedServer();
    const { org, cleanup: orgCleanup } = await createOrg(
      {
        KyselyPg: deps.KyselyPg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return {
      deps,
      org,
      async cleanup() {
        await orgCleanup();
        await shutdown();
      },
    };
  });

  describe('kyselyOrgFindBy*', () => {
    testWithFixture(
      'findById / findByName / findByEmail return the row when it exists',
      async ({ deps, org }) => {
        const byId = await kyselyOrgFindById(deps.KyselyPg, org.id);
        const byName = await kyselyOrgFindByName(deps.KyselyPg, org.name);
        const byEmail = await kyselyOrgFindByEmail(deps.KyselyPg, org.email);

        expect(byId).toMatchObject({ id: org.id, name: org.name });
        expect(byName).toMatchObject({ id: org.id });
        expect(byEmail).toMatchObject({ id: org.id });
      },
    );

    testWithFixture(
      'findById / findByName / findByEmail return undefined (not null) when missing',
      async ({ deps }) => {
        const byId = await kyselyOrgFindById(deps.KyselyPg, `missing-${uid()}`);
        const byName = await kyselyOrgFindByName(
          deps.KyselyPg,
          `missing-${uid()}`,
        );
        const byEmail = await kyselyOrgFindByEmail(
          deps.KyselyPg,
          `missing-${uid()}@example.com`,
        );

        // Callers use `== null` checks, but pin `undefined` explicitly to
        // catch silent drift to `null`.
        expect(byId).toBeUndefined();
        expect(byName).toBeUndefined();
        expect(byEmail).toBeUndefined();
      },
    );
  });

  describe('kyselyOrgInsert', () => {
    testWithFixture(
      'throws an invariant error for malformed input (defense-in-depth)',
      async ({ deps }) => {
        await expect(
          kyselyOrgInsert({
            db: deps.KyselyPg,
            id: uid(),
            email: 'not-an-email',
            name: `Bad_${uid()}`,
            websiteUrl: 'https://example.com',
          }),
        ).rejects.toThrow(/kyselyOrgInsert invariant violated: email/);
      },
    );

    testWithFixture(
      'apiKeyId is optional and defaults to NULL in the database',
      async ({ deps }) => {
        const id = uid();
        const inserted = await kyselyOrgInsert({
          db: deps.KyselyPg,
          id,
          email: faker.internet.email(),
          name: `Insert_NoApiKey_${id}`,
          websiteUrl: faker.internet.url(),
          // apiKeyId intentionally omitted
        });

        try {
          expect(inserted.id).toBe(id);

          const row = await deps.KyselyPg
            .selectFrom('public.orgs')
            .select(['api_key_id', 'on_call_alert_email'])
            .where('id', '=', id)
            .executeTakeFirstOrThrow();
          expect(row.api_key_id).toBeNull();
          expect(row.on_call_alert_email).toBeNull();
        } finally {
          await kyselyOrgDeleteById(deps.KyselyPg, id);
        }
      },
    );
  });

  describe('kyselyOrgUpdate', () => {
    testWithFixture(
      'throws an invariant error for malformed patch (defense-in-depth)',
      async ({ deps, org }) => {
        await expect(
          kyselyOrgUpdate(deps.KyselyPg, org.id, {
            // eslint-disable-next-line no-script-url
            websiteUrl: 'javascript:alert(1)',
          }),
        ).rejects.toThrow(/kyselyOrgUpdate invariant violated: websiteUrl/);
      },
    );

    testWithFixture(
      'returns undefined when the org does not exist',
      async ({ deps }) => {
        const result = await kyselyOrgUpdate(
          deps.KyselyPg,
          `missing-${uid()}`,
          { name: 'whatever' },
        );
        expect(result).toBeUndefined();
      },
    );

    testWithFixture(
      'empty-string websiteUrl is treated as "no change" (Sequelize parity)',
      async ({ deps, org }) => {
        const before = await kyselyOrgFindById(deps.KyselyPg, org.id);
        expect(before).toBeDefined();

        const updated = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          websiteUrl: '',
        });

        expect(updated).toBeDefined();
        expect(updated!.websiteUrl).toBe(before!.websiteUrl);
      },
    );

    testWithFixture(
      'null name / email / websiteUrl are skipped (only updated_at changes)',
      async ({ deps, org }) => {
        const before = await kyselyOrgFindById(deps.KyselyPg, org.id);
        expect(before).toBeDefined();

        const updated = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          name: null,
          email: null,
          websiteUrl: null,
        });

        expect(updated).toBeDefined();
        expect(updated!.name).toBe(before!.name);
        expect(updated!.email).toBe(before!.email);
        expect(updated!.websiteUrl).toBe(before!.websiteUrl);
      },
    );

    testWithFixture(
      'onCallAlertEmail: undefined skips, null clears, string sets',
      async ({ deps, org }) => {
        // Start by setting a value, then verify the three semantics.
        const initial = 'oncall@example.com';
        const set = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          onCallAlertEmail: initial,
        });
        expect(set!.onCallAlertEmail).toBe(initial);

        // undefined -> skip (value is preserved)
        const skipped = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          name: 'unrelated-touch',
        });
        expect(skipped!.onCallAlertEmail).toBe(initial);

        // null -> clear
        const cleared = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          onCallAlertEmail: null,
        });
        expect(cleared!.onCallAlertEmail).toBeNull();
      },
    );

    testWithFixture(
      'updates the provided fields and bumps updated_at',
      async ({ deps, org }) => {
        const newName = `Renamed_${uid()}`;
        const newWebsite = 'https://renamed.example.com';

        // Read updated_at directly since it isn't part of GraphQLOrgParent.
        const beforeRow = await deps.KyselyPg
          .selectFrom('public.orgs')
          .select(['updated_at'])
          .where('id', '=', org.id)
          .executeTakeFirstOrThrow();

        // Tiny wait so the new updated_at is strictly greater. Without this,
        // sub-millisecond updates can produce equal timestamps on fast hosts.
        await new Promise((resolve) => setTimeout(resolve, 5));

        const updated = await kyselyOrgUpdate(deps.KyselyPg, org.id, {
          name: newName,
          websiteUrl: newWebsite,
        });

        expect(updated!.name).toBe(newName);
        expect(updated!.websiteUrl).toBe(newWebsite);

        const afterRow = await deps.KyselyPg
          .selectFrom('public.orgs')
          .select(['updated_at'])
          .where('id', '=', org.id)
          .executeTakeFirstOrThrow();
        expect(afterRow.updated_at.getTime()).toBeGreaterThan(
          beforeRow.updated_at.getTime(),
        );
      },
    );
  });
});
