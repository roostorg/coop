// Load .env before anything reads process.env (the DI container does, heavily).
import 'dotenv/config';

import { test as base, type APIRequestContext } from '@playwright/test';
import { type Field } from '@roostorg/coop-types';
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
  const [createOrg, ums, userPersistence, createContentItemTypes] =
    await Promise.all([
      import(`${TRANSPILED}/test/fixtureHelpers/createOrg.js`) as Promise<
        typeof import('../../test/fixtureHelpers/createOrg.js')
      >,
      import(
        `${TRANSPILED}/services/userManagementService/index.js`
      ) as Promise<
        typeof import('../../services/userManagementService/index.js')
      >,
      import(
        `${TRANSPILED}/graphql/datasources/userKyselyPersistence.js`
      ) as Promise<
        typeof import('../../graphql/datasources/userKyselyPersistence.js')
      >,
      import(
        `${TRANSPILED}/test/fixtureHelpers/createContentItemTypes.js`
      ) as Promise<
        typeof import('../../test/fixtureHelpers/createContentItemTypes.js')
      >,
    ]);
  return {
    createOrg: createOrg.default,
    hashPassword: ums.hashPassword,
    UserRole: ums.UserRole,
    kyselyUserInsert: userPersistence.kyselyUserInsert,
    createContentItemTypes: createContentItemTypes.default,
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
  /** API key for the org's ingest endpoint (POST /api/v1/items/async). */
  apiKey: string;
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

    return {
      orgId: org.org.id,
      userId: user.id,
      email,
      password,
      apiKey: org.apiKey,
    };
  }

  /**
   * Create a content item type with the given fields. Wraps `createContentItemTypes`.
   * Returns the created item type; cleanup is left to multi-tenancy isolation
   * (unique org id), matching the rest of the seeder.
   */
  async createItemType(
    admin: SeededAdmin,
    fields: readonly Field[],
  ): Promise<{ id: string; name: string }> {
    const { createContentItemTypes } = await importSeedHelpers();
    const { itemTypes } = await createContentItemTypes({
      moderationConfigService: this.deps.ModerationConfigService,
      orgId: admin.orgId,
      extra: { fields: fields as [Field, ...Field[]] },
    });
    const itemType = itemTypes[0];
    return { id: itemType.id, name: itemType.name };
  }

  /**
   * Submit a content item via the real ingest endpoint (POST /api/v1/items/async),
   * routed through the same origin the browser uses (the vite dev proxy in dev,
   * or the served build in prod-like setups). Uses Playwright's request context
   * rather than the server's fetchHTTP: fetchHTTP is an app-code helper (undici +
   * tracing agent) that is fragile from the test process, whereas `request`
   * shares the browser's proven network path. The endpoint is async (202), so
   * the item may not be queryable immediately — callers should retry/poll on
   * read.
   */
  async submitContentItem(
    request: APIRequestContext,
    admin: SeededAdmin,
    itemTypeId: string,
    data: Record<string, unknown>,
  ): Promise<{ itemId: string }> {
    const itemId = uid();
    const res = await request.post('/api/v1/items/async', {
      headers: { 'x-api-key': admin.apiKey },
      data: { items: [{ id: itemId, typeId: itemTypeId, data }] },
    });
    if (res.status() !== 202) {
      throw new Error(
        `submitContentItem expected 202, got ${res.status()}: ${await res.text()}`,
      );
    }
    return { itemId };
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

      // Start the item-processing worker inline so that content submitted via
      // POST /api/v1/items/async gets drained from the Redis queue, run
      // through the rule engine, and indexed — without a separate worker
      // process. Mirrors test/integ/setupIntegrationServer.ts.
      const workerAbort = new AbortController();
      const workerRun = deps.ItemProcessingWorker.run(workerAbort.signal);
      workerRun.catch((err) => {
        console.error('ItemProcessingWorker exited with error', err);
      });

      await use(deps);

      workerAbort.abort();
      try {
        await deps.ItemProcessingWorker.shutdown();
      } catch {
        // Best-effort: BullMQ's Worker.close() closes the shared ioredis
        // connection, which can make closeSharedResourcesForShutdown throw
        // "Connection is closed." on its own quit(). Benign — swallow.
      }
      await deps.closeSharedResourcesForShutdown();
    },
    { scope: 'worker' },
  ],

  seed: async ({ deps }, use) => {
    await use(new Seeder(deps));
  },
});

export { expect } from '@playwright/test';
