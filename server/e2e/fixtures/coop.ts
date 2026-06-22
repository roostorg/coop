// Load .env before anything reads process.env (the DI container does, heavily).
import 'dotenv/config';

import { test as base } from '@playwright/test';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';

/**
 * Server runtime is loaded from the COMPILED output (`transpiled/`), not the TS
 * source. Playwright's esbuild loader transpiles each file in isolation and
 * can't tell a type written with value-import syntax (e.g. `import { JSON }`)
 * from a real value import, so importing the server's source graph throws
 * "does not provide an export named ...". `tsc` emits `transpiled/` with those
 * type-only imports correctly elided.
 *
 * Specifiers are built from this variable so `tsc` doesn't statically resolve
 * `transpiled/` (which only exists after a build); types come from
 * `typeof import(<source>)` casts. `transpiled/` is present whenever the server
 * is running — tsc-watch (local) and the Docker build both emit it.
 */
const TRANSPILED = '../../transpiled';

async function importIocContainer() {
  return (await import(
    `${TRANSPILED}/iocContainer/index.js`
  )) as typeof import('../../iocContainer/index.js');
}

async function importSeedHelpers() {
  const [createOrg, ums, userPersistence] = await Promise.all([
    import(`${TRANSPILED}/test/fixtureHelpers/createOrg.js`) as Promise<
      typeof import('../../test/fixtureHelpers/createOrg.js')
    >,
    import(`${TRANSPILED}/services/userManagementService/index.js`) as Promise<
      typeof import('../../services/userManagementService/index.js')
    >,
    import(
      `${TRANSPILED}/graphql/datasources/userKyselyPersistence.js`
    ) as Promise<
      typeof import('../../graphql/datasources/userKyselyPersistence.js')
    >,
  ]);
  return {
    createOrg: createOrg.default,
    hashPassword: ums.hashPassword,
    UserRole: ums.UserRole,
    kyselyUserInsert: userPersistence.kyselyUserInsert,
  };
}

export type SeededAdmin = {
  /** Org id the admin belongs to. */
  orgId: string;
  /** Admin user id. */
  userId: string;
  /** Email to log in with. */
  email: string;
  /** Plaintext password to log in with. */
  password: string;
};

/**
 * Seeds DB state for a test via the real DI factories (`test/fixtureHelpers`).
 *
 * There is intentionally no cleanup: every seeded org gets a unique id, so the
 * app's own multi-tenancy isolates tests from each other, and the CI database
 * is disposable. This keeps tests trivially parallelizable. See the README's
 * "Scaling to per-worker databases" note before adding cross-tenant or
 * global-state assertions — those would break this isolation model.
 */
class Seeder {
  constructor(private readonly deps: Dependencies) {}

  /**
   * Create an organization with a password-login admin user. The returned
   * credentials can be used to log in through the UI.
   */
  async orgWithAdmin(opts: { password?: string } = {}): Promise<SeededAdmin> {
    const password = opts.password ?? 'e2e-password';
    const { createOrg, hashPassword, UserRole, kyselyUserInsert } =
      await importSeedHelpers();

    const org = await createOrg(this.deps);

    const userId = uid();
    const email = `e2e-${userId}@example.com`;
    const user = await kyselyUserInsert({
      db: this.deps.KyselyPg,
      id: userId,
      orgId: org.org.id,
      email,
      password: await hashPassword(password),
      firstName: 'E2E',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      approvedByAdmin: true,
      loginMethods: ['password'],
    });

    return { orgId: org.org.id, userId: user.id, email, password };
  }
}

export type { Seeder };

type TestFixtures = { seed: Seeder };
type WorkerFixtures = { deps: Dependencies };

/**
 * Playwright test extended with server-side seeding. Each test creates the
 * state it needs via the real DI factories rather than relying on pre-seeded
 * data.
 *
 * The DI container is built once per worker (it opens real DB connections) and
 * imported dynamically so the heavy module graph only loads at run time, not
 * during test collection.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  deps: [
    // eslint-disable-next-line no-empty-pattern -- worker fixtures take no test args
    async ({}, use) => {
      const { default: getBottle } = await importIocContainer();
      const bottle = await getBottle();
      const deps = bottle.container as Dependencies;
      await use(deps);
      await deps.closeSharedResourcesForShutdown();
    },
    { scope: 'worker' },
  ],

  seed: async ({ deps }, use) => {
    await use(new Seeder(deps));
  },
});

export { expect } from '@playwright/test';
