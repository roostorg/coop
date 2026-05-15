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
      workerAbort.abort();
      await deps.ItemProcessingWorker.shutdown();
      await shutdownServer();
      await deps.closeSharedResourcesForShutdown();
    },
  };
}
