// Load .env before anything reads process.env (the DI container does, heavily).
import 'dotenv/config';

import { test as base } from '@playwright/test';

import { type Dependencies } from '../../iocContainer/index.js';

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
 * Seeds committed DB state for a test via the real DI factories
 * (`test/fixtureHelpers`) and tracks cleanups to run afterwards. Implemented as
 * a class so its internal mutation stays within the test-only eslint policy.
 */
class Seeder {
  private readonly cleanups: Array<() => Promise<void>> = [];

  constructor(private readonly deps: Dependencies) {}

  /**
   * Create an organization with a password-login admin user. The returned
   * credentials can be used to log in through the UI.
   */
  async orgWithAdmin(opts: { password?: string } = {}): Promise<SeededAdmin> {
    const password = opts.password ?? 'e2e-password';

    const [
      { default: createOrg },
      { hashPassword, UserRole },
      { kyselyUserInsert, kyselyUserDeleteById },
      { uid },
    ] = await Promise.all([
      import('../../test/fixtureHelpers/createOrg.js'),
      import('../../services/userManagementService/index.js'),
      import('../../graphql/datasources/userKyselyPersistence.js'),
      import('uid'),
    ]);

    const org = await createOrg(this.deps);
    this.cleanups.push(org.cleanup);

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
    this.cleanups.push(async () => {
      await kyselyUserDeleteById(this.deps.KyselyPg, user.id);
    });

    return { orgId: org.org.id, userId: user.id, email, password };
  }

  /** Best-effort teardown in reverse creation order (user before org). */
  async teardown(): Promise<void> {
    for (const cleanup of [...this.cleanups].reverse()) {
      try {
        await cleanup();
      } catch {
        // Ignore teardown failures so one bad cleanup doesn't mask the result.
      }
    }
  }
}

export type { Seeder };

type TestFixtures = { seed: Seeder };
type WorkerFixtures = { deps: Dependencies };

/**
 * Playwright test extended with server-side seeding. Each test creates the
 * state it needs via the real DI factories rather than relying on pre-seeded
 * data, and that state is cleaned up afterwards.
 *
 * The DI container is built once per worker (it opens real DB connections) and
 * imported dynamically so the heavy module graph only loads at run time, not
 * during test collection.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  deps: [
    // eslint-disable-next-line no-empty-pattern -- worker fixtures take no test args
    async ({}, use) => {
      const { default: getBottle } =
        await import('../../iocContainer/index.js');
      const bottle = await getBottle();
      const deps = bottle.container as Dependencies;
      await use(deps);
      await deps.closeSharedResourcesForShutdown();
    },
    { scope: 'worker' },
  ],

  seed: async ({ deps }, use) => {
    const seeder = new Seeder(deps);
    await use(seeder);
    await seeder.teardown();
  },
});

export { expect } from '@playwright/test';
