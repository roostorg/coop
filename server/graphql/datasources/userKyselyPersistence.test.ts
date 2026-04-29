import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { UserRole } from '../../models/types/permissioning.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import { makeMockedServer } from '../../test/setupMockedServer.js';
import { makeTestWithFixture } from '../../test/utils.js';
import {
  kyselyUserAddFavoriteRule,
  kyselyUserDeleteById,
  kyselyUserFindByEmail,
  kyselyUserFindById,
  kyselyUserFindByIdAndOrg,
  kyselyUserFindByIds,
  kyselyUserInsert,
  kyselyUserListByOrg,
  kyselyUserListFavoriteRuleIds,
  kyselyUserRemoveFavoriteRule,
  kyselyUserUpdate,
} from './userKyselyPersistence.js';

/**
 * Builds a valid `kyselyUserInsert` input with SAML-only login (no password),
 * so we don't need bcrypt in the unit-ish happy paths.
 */
function samlUserInput(orgId: string) {
  return {
    id: uid(),
    orgId,
    email: faker.internet.email(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    role: UserRole.ADMIN,
    loginMethods: ['saml'] as const,
    password: null,
  };
}

describe('userKyselyPersistence', () => {
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

  describe('kyselyUserInsert', () => {
    testWithFixture(
      'inserts a SAML user and round-trips fields + getPermissions()',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        const inserted = await kyselyUserInsert({
          db: deps.KyselyPg,
          ...input,
        });
        try {
          expect(inserted).toMatchObject({
            id: input.id,
            orgId: org.id,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            role: UserRole.ADMIN,
            loginMethods: ['saml'],
            password: null,
            approvedByAdmin: false,
            rejectedByAdmin: false,
          });
          expect(Array.isArray(inserted.getPermissions())).toBe(true);
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'inserts a password-login user with a password set',
      async ({ deps, org }) => {
        const id = uid();
        const row = await kyselyUserInsert({
          db: deps.KyselyPg,
          id,
          orgId: org.id,
          email: faker.internet.email(),
          firstName: 'Jane',
          lastName: 'Doe',
          role: UserRole.ADMIN,
          loginMethods: ['password'],
          password: 'hashed-password-placeholder',
        });
        try {
          expect(row.loginMethods).toEqual(['password']);
          expect(row.password).toBe('hashed-password-placeholder');
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, id);
        }
      },
    );

    testWithFixture(
      'throws an invariant error for malformed input (defense-in-depth)',
      async ({ deps, org }) => {
        await expect(
          kyselyUserInsert({
            db: deps.KyselyPg,
            id: uid(),
            orgId: org.id,
            email: 'not-an-email',
            firstName: 'A',
            lastName: 'B',
            role: UserRole.ADMIN,
            loginMethods: ['saml'],
            password: null,
          }),
        ).rejects.toThrow(/kyselyUserInsert invariant violated: email/);
      },
    );

    testWithFixture(
      "throws an invariant error when password/loginMethods disagree (CHECK constraint shape)",
      async ({ deps, org }) => {
        await expect(
          kyselyUserInsert({
            db: deps.KyselyPg,
            id: uid(),
            orgId: org.id,
            email: faker.internet.email(),
            firstName: 'A',
            lastName: 'B',
            role: UserRole.ADMIN,
            loginMethods: ['saml'],
            password: 'should-not-be-set',
          }),
        ).rejects.toThrow(/kyselyUserInsert invariant violated: password/);
      },
    );
  });

  describe('kyselyUserFindBy*', () => {
    testWithFixture(
      'findById / findByEmail / findByIdAndOrg return the row when it exists',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const byId = await kyselyUserFindById(deps.KyselyPg, input.id);
          const byEmail = await kyselyUserFindByEmail(
            deps.KyselyPg,
            input.email,
          );
          const byIdAndOrg = await kyselyUserFindByIdAndOrg(deps.KyselyPg, {
            id: input.id,
            orgId: org.id,
          });

          expect(byId).toMatchObject({ id: input.id, email: input.email });
          expect(byEmail).toMatchObject({ id: input.id });
          expect(byIdAndOrg).toMatchObject({ id: input.id, orgId: org.id });
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'find helpers return undefined (not null) when missing',
      async ({ deps, org }) => {
        const byId = await kyselyUserFindById(
          deps.KyselyPg,
          `missing-${uid()}`,
        );
        const byEmail = await kyselyUserFindByEmail(
          deps.KyselyPg,
          `missing-${uid()}@example.com`,
        );
        const byIdAndOrg = await kyselyUserFindByIdAndOrg(deps.KyselyPg, {
          id: `missing-${uid()}`,
          orgId: org.id,
        });

        expect(byId).toBeUndefined();
        expect(byEmail).toBeUndefined();
        expect(byIdAndOrg).toBeUndefined();
      },
    );

    testWithFixture(
      'findByIdAndOrg returns undefined when the user exists in a different org',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const result = await kyselyUserFindByIdAndOrg(deps.KyselyPg, {
            id: input.id,
            orgId: `different-org-${uid()}`,
          });
          expect(result).toBeUndefined();
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'findByIds returns [] for an empty input and handles mixed hits',
      async ({ deps, org }) => {
        expect(await kyselyUserFindByIds(deps.KyselyPg, [])).toEqual([]);

        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const rows = await kyselyUserFindByIds(deps.KyselyPg, [
            input.id,
            `missing-${uid()}`,
          ]);
          expect(rows).toHaveLength(1);
          expect(rows[0].id).toBe(input.id);
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'listByOrg scopes results to the provided org',
      async ({ deps, org }) => {
        const a = samlUserInput(org.id);
        const b = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...a });
        await kyselyUserInsert({ db: deps.KyselyPg, ...b });
        try {
          const rows = await kyselyUserListByOrg(deps.KyselyPg, org.id);
          const ids = rows.map((r) => r.id);
          expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
          expect(rows.every((r) => r.orgId === org.id)).toBe(true);
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, a.id);
          await kyselyUserDeleteById(deps.KyselyPg, b.id);
        }
      },
    );
  });

  describe('kyselyUserUpdate', () => {
    testWithFixture(
      'throws an invariant error for a malformed patch',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          await expect(
            kyselyUserUpdate(deps.KyselyPg, input.id, {
              email: 'not-an-email',
            }),
          ).rejects.toThrow(/kyselyUserUpdate invariant violated: email/);
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'returns undefined when the user does not exist',
      async ({ deps }) => {
        const result = await kyselyUserUpdate(
          deps.KyselyPg,
          `missing-${uid()}`,
          { firstName: 'Nobody' },
        );
        expect(result).toBeUndefined();
      },
    );

    testWithFixture(
      'null firstName / lastName / email / role are skipped (password untouched)',
      async ({ deps, org }) => {
        const input = {
          ...samlUserInput(org.id),
          loginMethods: ['password'] as const,
          password: 'placeholder',
        };
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const skipped = await kyselyUserUpdate(deps.KyselyPg, input.id, {
            firstName: null,
            lastName: null,
            email: null,
            role: null,
          });
          expect(skipped).toBeDefined();
          expect(skipped!.firstName).toBe(input.firstName);
          expect(skipped!.lastName).toBe(input.lastName);
          expect(skipped!.email).toBe(input.email);
          expect(skipped!.role).toBe(input.role);
          expect(skipped!.password).toBe('placeholder');
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    // NB: `kyselyUserUpdate` doesn't expose `loginMethods`, so we can't
    // *cleanly* clear a password on a password-login user through this helper
    // (the DB CHECK constraint — and our app-layer `validateUserCreateInput`
    // mirror of it — requires `password IS NOT NULL ⇔ 'password' ∈ login_methods`).
    // A SAML user already has `password: null`, so the `password: null` path
    // is a shape-valid no-op we can verify end-to-end here.
    testWithFixture(
      'password: null is a valid patch and leaves the column null on a SAML user',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const updated = await kyselyUserUpdate(deps.KyselyPg, input.id, {
            password: null,
          });
          expect(updated!.password).toBeNull();
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    // And conversely: trying to clear a password on a password-login user
    // without transitioning `loginMethods` must surface the DB CHECK
    // constraint. This protects against regressions if we ever loosen
    // `validateUserUpdatePatch`.
    testWithFixture(
      "clearing password on a password-login user violates password_null_when_not_present",
      async ({ deps, org }) => {
        const input = {
          ...samlUserInput(org.id),
          loginMethods: ['password'] as const,
          password: 'placeholder',
        };
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          await expect(
            kyselyUserUpdate(deps.KyselyPg, input.id, { password: null }),
          ).rejects.toThrow(/password_null_when_not_present/);
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );

    testWithFixture(
      'updates provided fields and bumps updated_at',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        try {
          const beforeRow = await deps.KyselyPg
            .selectFrom('public.users')
            .select(['updated_at'])
            .where('id', '=', input.id)
            .executeTakeFirstOrThrow();

          await new Promise((resolve) => setTimeout(resolve, 5));

          const updated = await kyselyUserUpdate(deps.KyselyPg, input.id, {
            firstName: 'Updated',
            approvedByAdmin: true,
          });
          expect(updated!.firstName).toBe('Updated');
          expect(updated!.approvedByAdmin).toBe(true);

          const afterRow = await deps.KyselyPg
            .selectFrom('public.users')
            .select(['updated_at'])
            .where('id', '=', input.id)
            .executeTakeFirstOrThrow();
          expect(afterRow.updated_at.getTime()).toBeGreaterThan(
            beforeRow.updated_at.getTime(),
          );
        } finally {
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );
  });

  describe('favorite rules helpers', () => {
    testWithFixture(
      'add / list / remove round-trip (and add is idempotent)',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.KyselyPg, ...input });
        // `users_and_favorite_rules.rule_id` has a FK to `public.rules`, so
        // we need a real rule row. Reuse the existing Sequelize fixture until
        // rule fixtures are themselves Kysely-backed.
        const rule = await createRule(deps.Sequelize, org.id, {
          creatorId: input.id,
        });
        try {
          expect(
            await kyselyUserListFavoriteRuleIds(deps.KyselyPg, input.id),
          ).toEqual([]);

          await kyselyUserAddFavoriteRule(deps.KyselyPg, input.id, rule.id);
          // Second add must be a no-op (matches Sequelize `addFavoriteRules`).
          await kyselyUserAddFavoriteRule(deps.KyselyPg, input.id, rule.id);

          expect(
            await kyselyUserListFavoriteRuleIds(deps.KyselyPg, input.id),
          ).toEqual([rule.id]);

          await kyselyUserRemoveFavoriteRule(deps.KyselyPg, input.id, rule.id);
          expect(
            await kyselyUserListFavoriteRuleIds(deps.KyselyPg, input.id),
          ).toEqual([]);
        } finally {
          await kyselyUserRemoveFavoriteRule(
            deps.KyselyPg,
            input.id,
            rule.id,
          ).catch(() => undefined);
          await rule.destroy().catch(() => undefined);
          await kyselyUserDeleteById(deps.KyselyPg, input.id);
        }
      },
    );
  });
});
