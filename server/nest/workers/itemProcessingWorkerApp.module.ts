import { Module, type DynamicModule } from '@nestjs/common';

import { type Dependencies } from '../../iocContainer/index.js';
import { CoopContainerModule } from '../coopContainer.module.js';
import { ItemProcessingModule } from './itemProcessing.module.js';

/** Root module of the item-processing worker process. */
@Module({})
export class ItemProcessingWorkerAppModule {
  static forRoot(deps: Dependencies): DynamicModule {
    return {
      module: ItemProcessingWorkerAppModule,
      imports: [CoopContainerModule.forRoot(deps), ItemProcessingModule],
    };
  }
}
