/**
 * Integration test harness: boots the real IoC container against running infra
 * (Postgres, Scylla, ClickHouse, Redis) and starts the item-processing worker
 * inline so that submissions land in the data stores within the same process.
 *
 * Requires the docker-compose stack from `npm run up` and migrations applied
 * via `npm run db:update`.
 */

import * as superTest from 'supertest';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import makeServer from '../../server.js';

export type IntegrationServer = {
  deps: Dependencies;
  request: ReturnType<typeof superTest.agent>;
  shutdown: () => Promise<void>;
};

/** Workers the harness knows how to run inline. */
export type HarnessWorkerName =
  'ItemProcessingWorker' | 'ReportedMediaBankingWorker';

export type MakeIntegrationServerOptions = {
  /** A hash of mocked dependencies to replace in the bottle  */
  mockedDeps?: Partial<Dependencies>;
  /** Workers to run inline. Defaults to the item-processing worker alone, so a
   * test that doesn't need banking doesn't pay for a second Redis consumer. */
  workers?: readonly HarnessWorkerName[];
};

export async function makeIntegrationServer(
  opts: MakeIntegrationServerOptions = {},
): Promise<IntegrationServer> {
  const bottle = await getBottle();
  if (opts.mockedDeps != null) {
    for (const [name, value] of Object.entries(opts.mockedDeps)) {
      bottle.factory(name as keyof Dependencies, () => value);
    }
  }
  const deps = bottle.container as Dependencies;

  const { app, shutdown: shutdownServer } = await makeServer(deps);
  const request = superTest.agent(app);

  const workerNames = opts.workers ?? ['ItemProcessingWorker'];

  const workerAbort = new AbortController();
  // Run the workers in the background — run() only settles on error or
  // shutdown, so we don't await them here.
  for (const name of workerNames) {
    deps[name].run(workerAbort.signal).catch((err) => {
      console.error(`${name} exited with error`, err);
    });
  }

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

      // BullMQ's Worker.close() already closes the shared ioredis connection,
      // so every later step that touches Redis — another worker's close(), or
      // closeSharedResourcesForShutdown — throws "Connection is closed" on a
      // connection that is already gone. That specific error is benign here,
      // since teardown is exactly what we are doing, so we swallow it.
      const ignoreClosedConnection = (err: unknown) => {
        if (err instanceof Error && err.message === 'Connection is closed.') {
          return;
        }
        throw err;
      };

      // One at a time, since they share a Redis connection.
      const workerErrors: unknown[] = [];
      for (const name of workerNames) {
        const err = await runStep(async () => {
          await deps[name].shutdown().catch(ignoreClosedConnection);
        });
        if (err !== null) {
          // eslint-disable-next-line functional/immutable-data -- local accumulator
          workerErrors.push(err);
        }
      }

      // Awaited left-to-right inside the array literal, so steps still run
      // sequentially — closeSharedResourcesForShutdown depends on the workers
      // having closed their Redis connections first.
      const teardownErrors = [
        ...workerErrors,
        await runStep(async () => {
          await shutdownServer();
        }),
        await runStep(async () => {
          await deps
            .closeSharedResourcesForShutdown()
            .catch(ignoreClosedConnection);
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
