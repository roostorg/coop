import { type Dependencies } from '../iocContainer/index.js';
import { safePick } from '../utils/misc.js';

/**
 * The slice of the IoC container that GraphQL resolvers can see, exposed on the
 * resolver context as `services`.
 *
 * This is deliberately an allowlist rather than the whole container: resolvers
 * get these keys and nothing else, which is what stops one reaching straight
 * for `Scylla` or `KyselyPg` instead of going through a service.
 */
export function makeGqlServices(deps: Dependencies) {
  return safePick(deps, [
    'ApiKeyService',
    'ContentAccessService',
    'DataWarehouse',
    'DerivedFieldsService',
    'getItemTypeEventuallyConsistent',
    'getEnabledRulesForItemTypeEventuallyConsistent',
    'ItemInvestigationService',
    'ModerationConfigService',
    'ManualReviewToolService',
    'HMAHashBankService',
    'NcmecService',
    'OrgSettingsService',
    'PartialItemsService',
    'ReportingService',
    'RuleEvaluator',
    'SignalsService',
    'SigningKeyPairService',
    'Tracer',
    'UserManagementService',
    'UserStatisticsService',
    'UserHistoryQueries',
    'UserStrikeService',
    'SSOService',
  ]);
}

export type GQLServices = ReturnType<typeof makeGqlServices>;
