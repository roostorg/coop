import { Controller, Get, Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { type Dependencies } from '../iocContainer/index.js';
import { AuthModule } from './auth/auth.module.js';
import { CoopContainerModule } from './coopContainer.module.js';
import { CoopExceptionFilter } from './coopExceptionFilter.js';
import { CoopGraphqlModule } from './graphql/coopGraphql.module.js';
import { ItemsController } from './rest/itemsController.js';
import { ItemsService } from './rest/itemsService.js';
import { LegacyRoutesModule } from './rest/legacyRoutes.module.js';
import { ReportingController } from './rest/reportingController.js';

@Controller()
class HealthController {
  // TODO: Decide if we want to check for database connectivity here,
  // or if services need to fail gracefully.
  @Get('ready')
  ready() {
    return 'Healthy';
  }
}

@Module({})
export class AppModule {
  static forRoot(deps: Dependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoopContainerModule.forRoot(deps),
        AuthModule,
        CoopGraphqlModule,
        LegacyRoutesModule,
      ],
      controllers: [HealthController, ItemsController, ReportingController],
      providers: [
        ItemsService,
        { provide: APP_FILTER, useClass: CoopExceptionFilter },
      ],
    };
  }
}
