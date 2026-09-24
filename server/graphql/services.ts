import { type Dependencies } from '../iocContainer/index.js';
import { makeKyselyTransactionWithRetry } from '../utils/kyselyTransactionWithRetry.js';
import { safePick } from '../utils/misc.js';

/**
 * The slice of the IoC container that GraphQL resolvers can see, exposed on the
 * resolver context as `services`.
 *
 * This is deliberately an allowlist rather than the whole container: resolvers
 * get these keys and nothing else, which is what stops one reaching straight
 * for `Scylla` or `KyselyPg` instead of going through a service.
 * The transaction runner supplies a transaction for service.forTransaction(),
 * without exposing the database pool on the resolver context.
 */
export function makeGqlServices(deps: Dependencies) {
  const services = safePick(deps, [
    'ApiKeyService',
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
  return {
    ...services,
    transaction: makeKyselyTransactionWithRetry(deps.KyselyPg),
  };
}

export type GQLServices = ReturnType<typeof makeGqlServices>;
