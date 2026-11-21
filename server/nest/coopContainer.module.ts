import { Global, Module, type DynamicModule } from '@nestjs/common';

import { type Dependencies } from '../iocContainer/index.js';
import { COOP_DEPS, depProvider } from './tokens.js';

// The BottleJS services that Nest-managed classes inject by name.
const BRIDGED_SERVICES = [
  'ApiKeyService',
  'ConfigService',
  'ContentApiLogger',
  'getItemTypeEventuallyConsistent',
  'HMAHashBankService',
  'ItemInvestigationService',
  'itemSubmissionQueueBulkWrite',
  'KyselyPg',
  'KyselyPgPool',
  'Meter',
  'ModerationConfigService',
  'OrgSettingsService',
  'RuleEngine',
  'Tracer',
] as const satisfies readonly (keyof Dependencies)[];

/**
 * Bridges the BottleJS container into Nest's DI. Services stay registered in
 * `iocContainer/`; a full migration would move each registration here as a
 * Nest factory provider (`inject()`-annotated factories map one-to-one onto
 * `{ provide, useFactory, inject }`).
 */
@Global()
@Module({})
export class CoopContainerModule {
  static forRoot(deps: Dependencies): DynamicModule {
    const providers = [
      { provide: COOP_DEPS, useValue: deps },
      ...BRIDGED_SERVICES.map(depProvider),
    ];
    return {
      module: CoopContainerModule,
      providers,
      exports: [COOP_DEPS, ...BRIDGED_SERVICES],
    };
  }
}
