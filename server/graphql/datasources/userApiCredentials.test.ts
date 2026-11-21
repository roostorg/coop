import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { vi } from 'vitest';

import {
  hashPassword,
  passwordMatchesHash,
} from '../../services/userManagementService/index.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { verifyEmailPasswordCredentials } from './userApiCredentials.js';

const { users } = schema;
const password = 'correct horse battery staple';

async function readStoredHash(db: CoopDb, userId: string) {
  const [row] = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, userId));
  return row.password;
}

describe('verifyEmailPasswordCredentials', () => {
  const testWithUser = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps);
    const { user } = await createUser(deps.DrizzlePg, org.id, {
      approvedByAdmin: true,
      loginMethods: ['password'],
      password,
    });
    const setStoredHash = async (hash: string) =>
      deps.DrizzlePg.update(users)
        .set({ password: hash })
        .where(eq(users.id, user.id));
    const getSamlSettings = vi.fn().mockResolvedValue(null);
    const logActiveSpanFailedIfAny = vi.fn();
    const credentialDeps = {
      db: deps.DrizzlePg,
      orgSettingsService: { getSamlSettings } as unknown as never,
      tracer: { logActiveSpanFailedIfAny } as unknown as never,
    };
    return {
      user,
      setStoredHash,
      getSamlSettings,
      logActiveSpanFailedIfAny,
      credentialDeps,
    };
  });

  testWithUser(
    'rehashes a legacy bcrypt hash to Argon2id on successful login',
    async ({ deps, user, setStoredHash, credentialDeps }) => {
      await setStoredHash(await bcrypt.hash(password, 5));

      const result = await verifyEmailPasswordCredentials(
        credentialDeps,
        user.email,
        password,
      );

      expect(result.id).toBe(user.id);
      const stored = await readStoredHash(deps.DrizzlePg, user.id);
      expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      // Verified through `passwordMatchesHash` — the same path a real login
      // takes — rather than reimplementing the comparison in the test.
      await expect(passwordMatchesHash(password, stored!)).resolves.toBe(true);
    },
  );

  testWithUser(
    'drops the rehash when the password changed after it was verified',
    async ({ deps, user, setStoredHash, getSamlSettings, credentialDeps }) => {
      // Compare-and-swap guard: the rehash write is scoped to the exact hash
      // that was just verified, so a concurrent password change (simulated
      // here between the lookup and the write) is never clobbered.
      await setStoredHash(await bcrypt.hash(password, 5));
      const concurrentHash = await hashPassword('a concurrent new password');
      getSamlSettings.mockImplementationOnce(async () => {
        await setStoredHash(concurrentHash);
        return null;
      });

      await verifyEmailPasswordCredentials(
        credentialDeps,
        user.email,
        password,
      );

      expect(await readStoredHash(deps.DrizzlePg, user.id)).toBe(
        concurrentHash,
      );
    },
  );

  testWithUser(
    'does not rehash when the stored hash is already a current Argon2id hash',
    async ({ deps, user, credentialDeps }) => {
      const before = await readStoredHash(deps.DrizzlePg, user.id);

      await verifyEmailPasswordCredentials(
        credentialDeps,
        user.email,
        password,
      );

      expect(await readStoredHash(deps.DrizzlePg, user.id)).toBe(before);
    },
  );

  testWithUser(
    'rejects a wrong password and does not attempt a rehash write',
    async ({ deps, user, setStoredHash, credentialDeps }) => {
      const legacyBcryptHash = await bcrypt.hash(password, 5);
      await setStoredHash(legacyBcryptHash);

      await expect(
        verifyEmailPasswordCredentials(credentialDeps, user.email, 'wrong'),
      ).rejects.toThrow();

      expect(await readStoredHash(deps.DrizzlePg, user.id)).toBe(
        legacyBcryptHash,
      );
    },
  );

  testWithUser(
    'surfaces a generic internal-server error and logs when the stored hash cannot be evaluated',
    async ({
      deps,
      user,
      setStoredHash,
      credentialDeps,
      logActiveSpanFailedIfAny,
    }) => {
      // A hash argon2 can't parse makes `passwordMatchesHash` throw. That's not
      // special-cased as "wrong password" — it propagates to the outer
      // catch-all, which logs it and rethrows as a generic `InternalServerError`.
      // The error name is pinned so a reintroduced "treat as non-match" special
      // case fails this test instead of silently reverting: a wrong password
      // throws a distinctly-named `LoginIncorrectPasswordError`.
      const unparseable = '$argon2id$v=19$m=19456,t=2,p=1$!!!!$!!!!';
      await setStoredHash(unparseable);

      await expect(
        verifyEmailPasswordCredentials(credentialDeps, user.email, password),
      ).rejects.toMatchObject({ name: 'InternalServerError' });

      expect(logActiveSpanFailedIfAny).toHaveBeenCalled();
      expect(await readStoredHash(deps.DrizzlePg, user.id)).toBe(unparseable);
    },
  );

  testWithUser(
    'fails the login when the rehash write throws',
    async ({
      deps,
      user,
      setStoredHash,
      credentialDeps,
      logActiveSpanFailedIfAny,
    }) => {
      await setStoredHash(await bcrypt.hash(password, 5));
      // A real PostgreSQL failure on the rehash UPDATE.
      await deps.DrizzlePg.execute(
        sql`CREATE FUNCTION pg_temp.reject_user_update() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'synthetic user update failure'; END;
      $$ LANGUAGE plpgsql`,
      );
      await deps.DrizzlePg.execute(
        sql`CREATE TRIGGER reject_user_update BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_user_update()`,
      );

      // A failing write means something is wrong with the database, and the
      // login fails loudly rather than being quietly downgraded to a success
      // with a stale hash. The user can retry if it was transient.
      await expect(
        verifyEmailPasswordCredentials(credentialDeps, user.email, password),
      ).rejects.toMatchObject({ name: 'InternalServerError' });

      expect(logActiveSpanFailedIfAny).toHaveBeenCalled();
    },
  );
});
