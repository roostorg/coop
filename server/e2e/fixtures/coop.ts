// Load .env before anything reads process.env (the DI container does, heavily).
import 'dotenv/config';

import { test as base } from '@playwright/test';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';

/**
 * Server runtime is loaded from the COMPILED output (`transpiled/`), not the TS
 * source, so we have to do some ugly type casting here.
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
 * app's own multi-tenancy isolates tests from each other.
 * This keeps tests parallelizable.
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
 * state it needs.
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
