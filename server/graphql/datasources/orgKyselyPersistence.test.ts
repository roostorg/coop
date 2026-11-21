import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { uid } from 'uid';

import { schema } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  kyselyOrgFindByEmail,
  kyselyOrgFindById,
  kyselyOrgFindByName,
  kyselyOrgInsert,
  kyselyOrgUpdate,
} from './orgKyselyPersistence.js';

describe('orgKyselyPersistence', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    return { org };
  });

  describe('kyselyOrgFindBy*', () => {
    testWithFixture(
      'findById / findByName / findByEmail return the row when it exists',
      async ({ deps, org }) => {
        const byId = await kyselyOrgFindById(deps.DrizzlePg, org.id);
        const byName = await kyselyOrgFindByName(deps.DrizzlePg, org.name);
        const byEmail = await kyselyOrgFindByEmail(deps.DrizzlePg, org.email);

        expect(byId).toMatchObject({ id: org.id, name: org.name });
        expect(byName).toMatchObject({ id: org.id });
        expect(byEmail).toMatchObject({ id: org.id });
      },
    );

    testWithFixture(
      'findById / findByName / findByEmail return undefined (not null) when missing',
      async ({ deps }) => {
        const byId = await kyselyOrgFindById(
          deps.DrizzlePg,
          `missing-${uid()}`,
        );
        const byName = await kyselyOrgFindByName(
          deps.DrizzlePg,
          `missing-${uid()}`,
        );
        const byEmail = await kyselyOrgFindByEmail(
          deps.DrizzlePg,
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
            db: deps.DrizzlePg,
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
          db: deps.DrizzlePg,
          id,
          email: faker.internet.email(),
          name: `Insert_NoApiKey_${id}`,
          websiteUrl: faker.internet.url(),
          // apiKeyId intentionally omitted
        });

        expect(inserted.id).toBe(id);

        const [row] = await deps.DrizzlePg.select({
          apiKeyId: schema.orgs.apiKeyId,
          onCallAlertEmail: schema.orgs.onCallAlertEmail,
        })
          .from(schema.orgs)
          .where(eq(schema.orgs.id, id));
        expect(row.apiKeyId).toBeNull();
        expect(row.onCallAlertEmail).toBeNull();
      },
    );
  });

  describe('kyselyOrgUpdate', () => {
    testWithFixture(
      'throws an invariant error for malformed patch (defense-in-depth)',
      async ({ deps, org }) => {
        await expect(
          kyselyOrgUpdate(deps.DrizzlePg, org.id, {
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
          deps.DrizzlePg,
          `missing-${uid()}`,
          { name: 'whatever' },
        );
        expect(result).toBeUndefined();
      },
    );

    testWithFixture(
      'empty-string websiteUrl is treated as "no change" (Sequelize parity)',
      async ({ deps, org }) => {
        const before = await kyselyOrgFindById(deps.DrizzlePg, org.id);
        expect(before).toBeDefined();

        const updated = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
          websiteUrl: '',
        });

        expect(updated).toBeDefined();
        expect(updated!.websiteUrl).toBe(before!.websiteUrl);
      },
    );

    testWithFixture(
      'null name / email / websiteUrl are skipped (only updated_at changes)',
      async ({ deps, org }) => {
        const before = await kyselyOrgFindById(deps.DrizzlePg, org.id);
        expect(before).toBeDefined();

        const updated = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
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
        const set = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
          onCallAlertEmail: initial,
        });
        expect(set!.onCallAlertEmail).toBe(initial);

        // undefined -> skip (value is preserved)
        const skipped = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
          name: 'unrelated-touch',
        });
        expect(skipped!.onCallAlertEmail).toBe(initial);

        // null -> clear
        const cleared = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
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
        const [beforeRow] = await deps.DrizzlePg.select({
          updatedAt: schema.orgs.updatedAt,
        })
          .from(schema.orgs)
          .where(eq(schema.orgs.id, org.id));

        // Tiny wait so the new updated_at is strictly greater. Without this,
        // sub-millisecond updates can produce equal timestamps on fast hosts.
        await new Promise((resolve) => setTimeout(resolve, 5));

        const updated = await kyselyOrgUpdate(deps.DrizzlePg, org.id, {
          name: newName,
          websiteUrl: newWebsite,
        });

        expect(updated!.name).toBe(newName);
        expect(updated!.websiteUrl).toBe(newWebsite);

        const [afterRow] = await deps.DrizzlePg.select({
          updatedAt: schema.orgs.updatedAt,
        })
          .from(schema.orgs)
          .where(eq(schema.orgs.id, org.id));
        expect(afterRow.updatedAt.getTime()).toBeGreaterThan(
          beforeRow.updatedAt.getTime(),
        );
      },
    );
  });
});
