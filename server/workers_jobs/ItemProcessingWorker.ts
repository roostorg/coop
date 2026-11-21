import { type INestApplicationContext } from '@nestjs/common';

import { type Dependencies } from '../iocContainer/index.js';
import { type Worker } from './index.js';

/**
 * Runs the item-processing BullMQ worker in a Nest application context (no
 * HTTP server). `bin/run-worker-or-job.ts ItemProcessingWorker` starts it, as
 * before. Nest is imported on run(), so the jobs, CLI scripts and tests that
 * build the container don't load it.
 */
export default function makeItemProcessingWorker(deps: Dependencies): Worker {
  let app: INestApplicationContext | undefined;
  return {
    type: 'Worker',
    async run() {
      const [
        { NestFactory },
        { ItemProcessingProcessor },
        { ItemProcessingWorkerAppModule },
        { CoopNestLogger },
      ] = await Promise.all([
        import('@nestjs/core'),
        import('../nest/workers/itemProcessing.module.js'),
        import('../nest/workers/itemProcessingWorkerApp.module.js'),
        import('../nest/coopLogger.js'),
      ]);
      app = await NestFactory.createApplicationContext(
        ItemProcessingWorkerAppModule.forRoot(deps),
        { logger: new CoopNestLogger(), abortOnError: false },
      );
      // Pending until the worker closes; rejects if BullMQ's run loop fails.
      await app.get(ItemProcessingProcessor).closed;
    },
    async shutdown() {
      await app?.close();
    },
  };
}
