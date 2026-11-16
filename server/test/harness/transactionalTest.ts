/**
 * Like `makeTestWithFixture`, but each test gets a fresh `makeMockedServer`
 * (real Postgres in a transaction) that's rolled back afterward, so fixtures
 * need no cleanup. Setup and tests receive `deps`, `request`, and the Express
 * `server`, which supports independent cookie jars via `superTest.agent(server)`.
 *
 * ```ts
 * const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
 *   const { org } = await createOrg({ ... }, uid());
 *   return { org };
 * });
 * testWithOrg('reads the org back', async ({ org }) => { ... });
 * ```
 */
import { makeMockedServer, type MockedServer } from '../setupMockedServer.js';
import { makeTestWithFixture, type Fixture } from '../utils.js';

type ServerVars = Pick<MockedServer, 'deps' | 'request' | 'server'>;

export function makeTransactionalTestWithFixture<
  T extends Record<string, unknown>,
>(makeFixtures: (server: ServerVars) => Promise<Fixture<T>> | Fixture<T>) {
  return makeTestWithFixture<ServerVars & T>(async () => {
    const server = await makeMockedServer();
    let fixtures: Fixture<T>;
    try {
      fixtures = await makeFixtures({
        deps: server.deps,
        request: server.request,
        server: server.server,
      });
    } catch (e) {
      // Nothing else cleans up when setup throws, and a transaction left open
      // hangs every test that runs after this one.
      try {
        await server.rollback();
      } finally {
        await server.shutdown();
      }
      throw e;
    }
    const { cleanup: cleanupFixtures, ...rest } = fixtures;
    return {
      deps: server.deps,
      request: server.request,
      server: server.server,
      ...(rest as unknown as T),
      async cleanup() {
        // The setup callback's own cleanup runs *before* the rollback, because
        // it may need rows that only exist inside the transaction. Obliterating
        // an org's Bull queues, for instance, means reading the queue rows to
        // find them — and a Postgres rollback can't reach Redis, so once those
        // rows are gone the keys are orphaned with nothing able to enumerate
        // them.
        //
        // `finally` so a throwing fixture cleanup still releases the
        // connection rather than leaking it for the rest of the run.
        try {
          await cleanupFixtures?.();
        } finally {
          await server.rollback();
          await server.shutdown();
        }
      },
    };
  });
}
