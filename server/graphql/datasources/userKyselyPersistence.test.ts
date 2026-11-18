import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { uid } from 'uid';

import { UserRole } from '../../services/userManagementService/index.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { seedSystemRolesForOrg } from './rolePersistence.js';
import {
  kyselyUserAddFavoriteRule,
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

const { roles, rolePermissions, users } = schema;

async function getSystemRoleId(db: CoopDb, orgId: string, key: UserRole) {
  const [row] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.key, key)));
  return row;
}

async function getUserUpdatedAt(db: CoopDb, id: string) {
  const [row] = await db
    .select({ updatedAt: users.updatedAt })
    .from(users)
    .where(eq(users.id, id));
  return row;
}

/** SAML-only `kyselyUserInsert` input — no password keeps bcrypt out of happy paths. */
function samlUserInput(orgId: string) {
  return {
    id: uid(),
    orgId,
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: UserRole.ADMIN,
    loginMethods: ['saml'] as const,
    password: null,
  };
}

describe('userKyselyPersistence', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(
      {
        DrizzlePg: deps.DrizzlePg,
        ModerationConfigService: deps.ModerationConfigService,
        ApiKeyService: deps.ApiKeyService,
      },
      uid(),
    );
    await seedSystemRolesForOrg(deps.DrizzlePg, org.id);
    return { org };
  });

  describe('kyselyUserInsert', () => {
    testWithFixture(
      'inserts a SAML user and round-trips fields + getPermissions()',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        const inserted = await kyselyUserInsert({
          db: deps.DrizzlePg,
          ...input,
        });
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
        const [persisted] = await deps.DrizzlePg.select({
          roleId: users.roleId,
        })
          .from(users)
          .where(eq(users.id, input.id));
        const adminRole = await getSystemRoleId(
          deps.DrizzlePg,
          org.id,
          UserRole.ADMIN,
        );
        expect(persisted.roleId).toBe(adminRole.id);
        const permissions = inserted.getPermissions();
        expect(permissions).toContain('MANAGE_ORG');
        expect(permissions).toContain('MANAGE_ROLES');
      },
    );

    testWithFixture(
      'updating role swaps role_id so getPermissions() reflects the new role',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const updated = await kyselyUserUpdate(deps.DrizzlePg, input.id, {
          role: UserRole.ANALYST,
        });
        expect(updated!.role).toBe(UserRole.ANALYST);
        const [persisted] = await deps.DrizzlePg.select({
          roleId: users.roleId,
          key: roles.key,
        })
          .from(users)
          .innerJoin(roles, eq(roles.id, users.roleId))
          .where(eq(users.id, input.id));
        expect(persisted.key).toBe(UserRole.ANALYST);
        const permissions = updated!.getPermissions();
        expect(permissions).toContain('VIEW_INSIGHTS');
        expect(permissions).not.toContain('MANAGE_ORG');
      },
    );

    testWithFixture(
      'getPermissions() reads from public.role_permissions when the org has saved them',
      async ({ deps, org }) => {
        // Reduced ADMIN set distinguishes DB result from the static fallback.
        const roleRow = await getSystemRoleId(
          deps.DrizzlePg,
          org.id,
          UserRole.ADMIN,
        );
        await deps.DrizzlePg.delete(rolePermissions).where(
          eq(rolePermissions.roleId, roleRow.id),
        );
        await deps.DrizzlePg.insert(rolePermissions).values({
          roleId: roleRow.id,
          permission: 'MANAGE_ORG',
        });

        const input = samlUserInput(org.id);
        const inserted = await kyselyUserInsert({
          db: deps.DrizzlePg,
          ...input,
        });
        expect(inserted.getPermissions()).toEqual(['MANAGE_ORG']);
      },
    );

    testWithFixture(
      'getPermissions() returns [] (no static fallback) when the role has zero saved permissions',
      async ({ deps, org }) => {
        // Regression: empty `role_permissions` is least-privilege; defaults would over-grant.
        const adminRole = await getSystemRoleId(
          deps.DrizzlePg,
          org.id,
          UserRole.ADMIN,
        );
        await deps.DrizzlePg.delete(rolePermissions).where(
          eq(rolePermissions.roleId, adminRole.id),
        );

        const input = samlUserInput(org.id);
        const inserted = await kyselyUserInsert({
          db: deps.DrizzlePg,
          ...input,
        });
        expect(inserted.getPermissions()).toEqual([]);
      },
    );

    testWithFixture(
      'throws when the requested org-scoped role is missing',
      async ({ deps, org }) => {
        await deps.DrizzlePg.delete(roles).where(
          and(eq(roles.orgId, org.id), eq(roles.key, UserRole.ADMIN)),
        );

        await expect(
          kyselyUserInsert({
            db: deps.DrizzlePg,
            ...samlUserInput(org.id),
          }),
        ).rejects.toThrow();
      },
    );

    testWithFixture(
      'inserts a password-login user with a password set',
      async ({ deps, org }) => {
        const id = uid();
        const row = await kyselyUserInsert({
          db: deps.DrizzlePg,
          id,
          orgId: org.id,
          email: faker.internet.email(),
          firstName: 'Jane',
          lastName: 'Doe',
          role: UserRole.ADMIN,
          loginMethods: ['password'],
          password: 'hashed-password-placeholder',
        });
        expect(row.loginMethods).toEqual(['password']);
        expect(row.password).toBe('hashed-password-placeholder');
      },
    );

    testWithFixture(
      'throws an invariant error for malformed input (defense-in-depth)',
      async ({ deps, org }) => {
        await expect(
          kyselyUserInsert({
            db: deps.DrizzlePg,
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
      'throws an invariant error when password/loginMethods disagree (CHECK constraint shape)',
      async ({ deps, org }) => {
        await expect(
          kyselyUserInsert({
            db: deps.DrizzlePg,
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
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const byId = await kyselyUserFindById(deps.DrizzlePg, input.id);
        const byEmail = await kyselyUserFindByEmail(
          deps.DrizzlePg,
          input.email,
        );
        const byIdAndOrg = await kyselyUserFindByIdAndOrg(deps.DrizzlePg, {
          id: input.id,
          orgId: org.id,
        });

        expect(byId).toMatchObject({ id: input.id, email: input.email });
        expect(byEmail).toMatchObject({ id: input.id });
        expect(byIdAndOrg).toMatchObject({ id: input.id, orgId: org.id });
      },
    );

    testWithFixture(
      'find helpers return undefined (not null) when missing',
      async ({ deps, org }) => {
        const byId = await kyselyUserFindById(
          deps.DrizzlePg,
          `missing-${uid()}`,
        );
        const byEmail = await kyselyUserFindByEmail(
          deps.DrizzlePg,
          `missing-${uid()}@example.com`,
        );
        const byIdAndOrg = await kyselyUserFindByIdAndOrg(deps.DrizzlePg, {
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
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const result = await kyselyUserFindByIdAndOrg(deps.DrizzlePg, {
          id: input.id,
          orgId: `different-org-${uid()}`,
        });
        expect(result).toBeUndefined();
      },
    );

    testWithFixture(
      'findByIds returns [] for an empty input and handles mixed hits',
      async ({ deps, org }) => {
        expect(await kyselyUserFindByIds(deps.DrizzlePg, [])).toEqual([]);

        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const rows = await kyselyUserFindByIds(deps.DrizzlePg, [
          input.id,
          `missing-${uid()}`,
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(input.id);
      },
    );

    testWithFixture(
      'listByOrg scopes results to the provided org',
      async ({ deps, org }) => {
        const a = samlUserInput(org.id);
        const b = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...a });
        await kyselyUserInsert({ db: deps.DrizzlePg, ...b });
        const rows = await kyselyUserListByOrg(deps.DrizzlePg, org.id);
        const ids = rows.map((r) => r.id);
        expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
        expect(rows.every((r) => r.orgId === org.id)).toBe(true);
      },
    );

    testWithFixture(
      'find and list helpers derive role from the linked role row',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const analyst = await getSystemRoleId(
          deps.DrizzlePg,
          org.id,
          UserRole.ANALYST,
        );
        await deps.DrizzlePg.update(users)
          .set({ roleId: analyst.id })
          .where(eq(users.id, input.id));

        expect((await kyselyUserFindById(deps.DrizzlePg, input.id))!.role).toBe(
          UserRole.ANALYST,
        );
        expect(
          (await kyselyUserListByOrg(deps.DrizzlePg, org.id)).find(
            ({ id }) => id === input.id,
          )!.role,
        ).toBe(UserRole.ANALYST);
      },
    );
  });

  describe('kyselyUserUpdate', () => {
    testWithFixture(
      'throws when updating to a missing org-scoped role',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        await deps.DrizzlePg.delete(roles).where(
          and(eq(roles.orgId, org.id), eq(roles.key, UserRole.ANALYST)),
        );

        await expect(
          kyselyUserUpdate(deps.DrizzlePg, input.id, {
            role: UserRole.ANALYST,
          }),
        ).rejects.toThrow();
      },
    );

    testWithFixture(
      'throws an invariant error for a malformed patch',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        await expect(
          kyselyUserUpdate(deps.DrizzlePg, input.id, {
            email: 'not-an-email',
          }),
        ).rejects.toThrow(/kyselyUserUpdate invariant violated: email/);
      },
    );

    testWithFixture(
      'returns undefined when the user does not exist',
      async ({ deps }) => {
        const result = await kyselyUserUpdate(
          deps.DrizzlePg,
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
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const skipped = await kyselyUserUpdate(deps.DrizzlePg, input.id, {
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
      },
    );

    // SAML users already have password: null, so `{ password: null }` is a
    // shape-valid no-op (CHECK constraint requires password ⇔ 'password' ∈ loginMethods).
    testWithFixture(
      'password: null is a valid patch and leaves the column null on a SAML user',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const updated = await kyselyUserUpdate(deps.DrizzlePg, input.id, {
          password: null,
        });
        expect(updated!.password).toBeNull();
      },
    );

    // Clearing a password on a password-login user must surface the DB
    // CHECK constraint if `validateUserUpdatePatch` ever loosens.
    testWithFixture(
      'clearing password on a password-login user violates password_null_when_not_present',
      async ({ deps, org }) => {
        const input = {
          ...samlUserInput(org.id),
          loginMethods: ['password'] as const,
          password: 'placeholder',
        };
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        // Drizzle wraps the pg error; the constraint is on `cause`.
        await expect(
          kyselyUserUpdate(deps.DrizzlePg, input.id, { password: null }),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({
            constraint: 'password_null_when_not_present',
          }),
        });
      },
    );

    testWithFixture(
      'updates provided fields and bumps updated_at',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        const beforeRow = await getUserUpdatedAt(deps.DrizzlePg, input.id);

        await new Promise((resolve) => setTimeout(resolve, 5));

        const updated = await kyselyUserUpdate(deps.DrizzlePg, input.id, {
          firstName: 'Updated',
          approvedByAdmin: true,
        });
        expect(updated!.firstName).toBe('Updated');
        expect(updated!.approvedByAdmin).toBe(true);

        const afterRow = await getUserUpdatedAt(deps.DrizzlePg, input.id);
        expect(afterRow.updatedAt.getTime()).toBeGreaterThan(
          beforeRow.updatedAt.getTime(),
        );
      },
    );
  });

  describe('favorite rules helpers', () => {
    testWithFixture(
      'add / list / remove round-trip (and add is idempotent)',
      async ({ deps, org }) => {
        const input = samlUserInput(org.id);
        await kyselyUserInsert({ db: deps.DrizzlePg, ...input });
        // `users_and_favorite_rules.rule_id` has a FK to `public.rules`, so
        // we need a real rule row.
        const rule = await createRule(deps.DrizzlePg, org.id, {
          creatorId: input.id,
        });
        expect(
          await kyselyUserListFavoriteRuleIds(deps.DrizzlePg, input.id),
        ).toEqual([]);

        await kyselyUserAddFavoriteRule(deps.DrizzlePg, input.id, rule.id);
        // Second add must be a no-op (matches Sequelize `addFavoriteRules`).
        await kyselyUserAddFavoriteRule(deps.DrizzlePg, input.id, rule.id);

        expect(
          await kyselyUserListFavoriteRuleIds(deps.DrizzlePg, input.id),
        ).toEqual([rule.id]);

        await kyselyUserRemoveFavoriteRule(deps.DrizzlePg, input.id, rule.id);
        expect(
          await kyselyUserListFavoriteRuleIds(deps.DrizzlePg, input.id),
        ).toEqual([]);
      },
    );
  });
});
