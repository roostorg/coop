/**
 * Integration test harness: boots the real IoC container against running infra
 * (Postgres, Scylla, ClickHouse, Redis) and starts the item-processing worker
 * inline so that submissions land in the data stores within the same process.
 *
 * Requires the docker-compose stack from `npm run up` and migrations applied
 * via `npm run db:update`.
 */

import passport from 'passport';
import * as superTest from 'supertest';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import makeServer from '../../server.js';

export type IntegrationServer = {
  deps: Dependencies;
  request: ReturnType<typeof superTest.agent>;
  shutdown: () => Promise<void>;
};

export type MakeIntegrationServerOptions = {
  /** A hash of mocked dependencies to replace in the bottle  */
  mockedDeps?: Partial<Dependencies>;
};

export async function makeIntegrationServer(
  opts: MakeIntegrationServerOptions = {},
): Promise<IntegrationServer> {
  // passport keeps its state globally so we need to reset it each time we make a new server
  // there is no public API to reset serializers/deserializers so we resort to clearing them.
  type PassportInternals = {
    _serializers: Array<unknown>;
    _deserializers: Array<unknown>;
    _strategies: Record<string, unknown>;
  };
  const passportInternals = passport as unknown as PassportInternals;
  // eslint-disable-next-line functional/immutable-data
  passportInternals._serializers = [];
  // eslint-disable-next-line functional/immutable-data
  passportInternals._deserializers = [];
  for (const key of Object.keys(passportInternals._strategies)) {
    if (key !== 'session') {
      passport.unuse(key);
    }
  }

  const bottle = await getBottle();
  if (opts.mockedDeps != null) {
    for (const [name, value] of Object.entries(opts.mockedDeps)) {
      bottle.factory(name as keyof Dependencies, () => value);
    }
  }
  const deps = bottle.container as Dependencies;

  const { app, shutdown: shutdownServer } = await makeServer(deps);
  const request = superTest.agent(app);

  const workerAbort = new AbortController();
  // Run the worker in the background — its run() promise only settles on error
  // or shutdown, so we don't await it here.
  const workerRun = deps.ItemProcessingWorker.run(workerAbort.signal);
  workerRun.catch((err) => {
    console.error('ItemProcessingWorker exited with error', err);
  });

  return {
    deps,
    request,
    async shutdown() {
      // Best-effort teardown: run every step even if an earlier one throws,
      // so we don't leak the server or shared resources into the next test.
      workerAbort.abort();

      const runStep = async (
        fn: () => Promise<void>,
      ): Promise<unknown | null> => {
        try {
          await fn();
          return null;
        } catch (err) {
          return err;
        }
      };

      // Awaited left-to-right inside the array literal, so steps still run
      // sequentially — closeSharedResourcesForShutdown depends on the worker
      // having closed its Redis connection first.
      const teardownErrors = [
        await runStep(async () => {
          await deps.ItemProcessingWorker.shutdown();
        }),
        await runStep(async () => {
          await shutdownServer();
        }),
        await runStep(async () => {
          // BullMQ's Worker.close() already closes the shared ioredis
          // connection, which makes closeSharedResourcesForShutdown throw
          // "Connection is closed" when it tries to quit() redis a second
          // time. That specific error is benign — every shared resource is
          // already torn down — so we swallow it here rather than leak the
          // failure into afterAll.
          await deps.closeSharedResourcesForShutdown().catch((err) => {
            if (
              err instanceof Error &&
              err.message === 'Connection is closed.'
            ) {
              return;
            }
            throw err;
          });
        }),
      ].filter((e): e is unknown => e !== null);

      if (teardownErrors.length > 0) {
        throw new AggregateError(
          teardownErrors,
          'Integration server shutdown failed',
        );
      }
    },
  };
}
