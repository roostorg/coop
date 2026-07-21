// Env is loaded via `--env-file-if-exists=.env` (local) or the docker-compose
// `env_file` directive (CI) before this process starts; nothing to import here.

import { test as base, type APIRequestContext } from '@playwright/test';
import { uid } from 'uid';

import { type Dependencies } from '../../iocContainer/index.js';
import { jsonStringify } from '../../utils/encoding.js';

export { jsonStringify };

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
  const [
    createOrg,
    ums,
    userPersistence,
    createRule,
    createMrtQueue,
    itemSubmissionQueue,
  ] = await Promise.all([
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
    import(`${TRANSPILED}/test/fixtureHelpers/createRule.js`) as Promise<
      typeof import('../../test/fixtureHelpers/createRule.js')
    >,
    import(`${TRANSPILED}/test/fixtureHelpers/createMrtQueue.js`) as Promise<
      typeof import('../../test/fixtureHelpers/createMrtQueue.js')
    >,
    import(`${TRANSPILED}/queues/itemSubmissionQueue.js`) as Promise<
      typeof import('../../queues/itemSubmissionQueue.js')
    >,
  ]);
  return {
    createOrg: createOrg.default,
    hashPassword: ums.hashPassword,
    UserRole: ums.UserRole,
    kyselyUserInsert: userPersistence.kyselyUserInsert,
    createRule: createRule.default,
    createMrtQueue: createMrtQueue.default,
    ITEM_SUBMISSION_QUEUE_NAME: itemSubmissionQueue.ITEM_SUBMISSION_QUEUE_NAME,
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
   * Create an MRT queue for the org. The first queue created for an org becomes
   * the default queue (the destination for ENQUEUE_TO_MRT when no routing rule
   * matches), so create exactly one queue before submitting if you rely on the
   * default. The admin is assigned as a reviewer so the queue's jobs are
   * visible to them via `reviewableQueues`.
   */
  async createMrtQueue(
    admin: SeededAdmin,
  ): Promise<{ id: string; name: string }> {
    const { createMrtQueue } = await importSeedHelpers();
    const { queue } = await createMrtQueue({
      orgId: admin.orgId,
      mrtService: this.deps.ManualReviewToolService,
      userId: admin.userId,
    });
    return { id: queue.id, name: queue.name };
  }

  /**
   * Create a LIVE content rule scoped to `itemTypeId` with the given
   * `conditionSet` and `actionIds`. The conditionSet (what the rule matches)
   * is owned by the caller; this factory just persists it via the
   * `createRule` fixture helper.
   */
  async createRule(
    admin: SeededAdmin,
    itemTypeId: string,
    rule: {
      conditionSet: unknown;
      actionIds?: readonly string[];
    },
  ): Promise<{ id: string; name: string }> {
    const { createRule } = await importSeedHelpers();
    const created = await createRule(this.deps.KyselyPg, admin.orgId, {
      actionIds: rule.actionIds ?? [],
      contentTypeIds: [itemTypeId],
      conditionSet: rule.conditionSet as never,
    });
    return { id: created.id, name: created.name };
  }

  /**
   * Submit a content item via the real ingest endpoint (POST /api/v1/items/async),
   * routed through the same origin the browser uses. The endpoint is async
   * (202), so callers should waitForQueueDrained before reading the item.
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

  /**
   * Block until the item-submission BullMQ queue has no waiting or active jobs —
   * i.e. every submitted item has been fully processed (written to Scylla,
   * run through the rule engine, and any MRT jobs enqueued). Call this after
   * `submitContentItem` and before navigating to a page that reads the
   * processed item, so the read sees the data without the test having to
   * poll the UI itself.
   */
  async waitForQueueDrained(timeoutMs = 30_000): Promise<void> {
    const { ITEM_SUBMISSION_QUEUE_NAME } = await importSeedHelpers();
    const waitKey = `bull:${ITEM_SUBMISSION_QUEUE_NAME}:wait`;
    const activeKey = `bull:${ITEM_SUBMISSION_QUEUE_NAME}:active`;
    const redis = this.deps.IORedis;
    const llen = async (key: string) => Number(await redis.llen(key));
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if ((await llen(waitKey)) + (await llen(activeKey)) === 0) return;
      if (Date.now() >= deadline) {
        throw new Error('item-submission queue did not drain in time');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Authenticate as `admin` by calling the real `login` GraphQL mutation via
   * `page.request`, which shares the page's cookie jar — so the session cookie
   * the server sets lands on the browser automatically. Skips the UI login
   * form, which other tests don't need to exercise (login.spec.ts does). After
   * this, `page.goto('/dashboard/...')` works without re-authenticating.
   */
  async login(
    page: import('@playwright/test').Page,
    admin: SeededAdmin,
  ): Promise<void> {
    const res = await page.request.post('/api/v1/graphql', {
      data: {
        query: `mutation Login($input: LoginInput!) {
  login(input: $input) {
    __typename
    ... on LoginSuccessResponse { user { id } }
    ... on LoginUserDoesNotExistError { title }
    ... on LoginIncorrectPasswordError { title }
  }
}`,
        variables: { input: { email: admin.email, password: admin.password } },
      },
    });
    if (!res.ok()) {
      throw new Error(
        `login mutation HTTP ${res.status()}: ${await res.text()}`,
      );
    }
    const body = (await res.json()) as {
      data?: { login: { __typename: string } };
      errors?: unknown;
    };
    const typename = body.data?.login.__typename;
    if (typename !== 'LoginSuccessResponse') {
      throw new Error(
        `login failed: expected LoginSuccessResponse, got ${typename ?? 'no data'}`,
      );
    }
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
      // process.
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
        // BullMQ's Worker.close() closes the shared ioredis connection, which
        // can make closeSharedResourcesForShutdown throw on its own quit().
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
