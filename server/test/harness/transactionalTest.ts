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
import { makeTestWithFixture } from '../utils.js';

type ServerVars = Pick<MockedServer, 'deps' | 'request'>;

export function makeTransactionalTestWithFixture<
  T extends Record<string, unknown>,
>(makeFixtures: (server: ServerVars) => Promise<T> | T) {
  return makeTestWithFixture<ServerVars & T>(async () => {
    const server = await makeMockedServer();
    const fixtures = await makeFixtures({
      deps: server.deps,
      request: server.request,
    });
    return {
      deps: server.deps,
      request: server.request,
      ...fixtures,
      async cleanup() {
        await server.rollback();
        await server.shutdown();
      },
    };
  });
}
