/**
 * Integration test harness: boots the real IoC container against running infra
 * (Postgres, Scylla, ClickHouse, Redis) and starts the item-processing worker
 * inline so that submissions land in the data stores within the same process.
 *
 * Requires the docker-compose stack from `npm run up` and migrations applied
 * via `npm run db:update`.
 */
// Load .env before any module that reads process.env (notably the IoC
// container). The unit-test `npm test` path goes through dotenv via its
// NODE_OPTIONS; `test:integ` does not, so we do it here.
import 'dotenv/config';

import * as superTest from 'supertest';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import makeServer from '../../server.js';

export type IntegrationServer = {
  deps: Dependencies;
  request: ReturnType<typeof superTest.agent>;
  shutdown: () => Promise<void>;
};

export async function makeIntegrationServer(): Promise<IntegrationServer> {
  const bottle = await getBottle();
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
