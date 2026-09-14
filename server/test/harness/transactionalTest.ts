/**
 * Like `makeTestWithFixture`, but each test gets a fresh `makeMockedServer`
 * (real Postgres in a transaction) that's rolled back afterward, so fixtures
 * need no cleanup. The setup callback receives `{ deps, request }` and returns
 * its fixtures; the test gets those plus `deps` and `request`.
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

type ServerVars = Pick<MockedServer, 'deps' | 'request'>;

export function makeTransactionalTestWithFixture<
  T extends Record<string, unknown>,
>(makeFixtures: (server: ServerVars) => Promise<Fixture<T>> | Fixture<T>) {
  return makeTestWithFixture<ServerVars & T>(async () => {
    const server = await makeMockedServer();
    const { cleanup: cleanupFixtures, ...fixtures } = await makeFixtures({
      deps: server.deps,
      request: server.request,
    });
    return {
      deps: server.deps,
      request: server.request,
      ...(fixtures as unknown as T),
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
