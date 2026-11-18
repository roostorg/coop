import {
  Module,
  type DynamicModule,
  type INestApplicationContext,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { type Dependencies } from '../iocContainer/index.js';
import { CoopContainerModule } from '../nest/coopContainer.module.js';
import { CoopNestLogger } from '../nest/coopLogger.js';
import {
  ItemProcessingModule,
  ItemProcessingProcessor,
} from '../nest/workers/itemProcessing.module.js';
import { type Worker } from './index.js';

@Module({})
class ItemProcessingWorkerAppModule {
  static forRoot(deps: Dependencies): DynamicModule {
    return {
      module: ItemProcessingWorkerAppModule,
      imports: [CoopContainerModule.forRoot(deps), ItemProcessingModule],
    };
  }
}

/**
 * Runs the item-processing BullMQ worker in a Nest application context (no
 * HTTP server). `bin/run-worker-or-job.ts ItemProcessingWorker` starts it, as
 * before.
 */
export default function makeItemProcessingWorker(deps: Dependencies): Worker {
  let app: INestApplicationContext | undefined;
  return {
    type: 'Worker',
    async run() {
      app = await NestFactory.createApplicationContext(
        ItemProcessingWorkerAppModule.forRoot(deps),
        { logger: new CoopNestLogger(), abortOnError: false },
      );
      // Keep run() pending until the worker is closed.
      await app.get(ItemProcessingProcessor).closed;
    },
    async shutdown() {
      await app?.close();
    },
  };
}
