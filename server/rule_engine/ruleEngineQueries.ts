/**
 * @fileoverview This defines a few separate "services" that can be injected
 * into the RuleEngine and other services in the POST /content hot path (like
 * the signal execution service) to enable those services to make the queries
 * they need to run a rule. Having these queries defined separately + injected
 * into the consumers gives us a cleaner place to add optimizations to the query
 * logic (i.e., run the queries against replicas, add caching, etc) and makes
 * the consumers much more unit testable.
 */
import { Op } from 'sequelize';

import { inject } from '../iocContainer/index.js';
import { type LocationArea } from '../models/types/locationArea.js';
import { type Action } from '../services/moderationConfigService/index.js';
import { cached } from '../utils/caching.js';
import { jsonParse, jsonStringify } from '../utils/encoding.js';
import { getUtcDateOnlyString } from '../utils/time.js';

export const makeGetEnabledRulesForItemTypeEventuallyConsistent = inject(
  ['getSequelizeItemTypeEventuallyConsistent'],
  function (getSequelizeItemTypeEventuallyConsistent) {
    return cached({
      async producer(itemTypeId: string) {
        // Getting the enabledRules is currently coupled to sequelize, so,
        // annoyingly, we first have to convert the contentTypeId into a full
        // contentType model object. However, we don't want to incur too much
        // overhead for that, so we use a cached lookup. (Note: we can't just
        // take a model object as the argument because our caching library
        // requires the cache key to be a string; further, even if we could just
        // accept the model object, we wouldn't want to, because we want to move
        // away from this coupling to sequelize.)
        const itemType = await getSequelizeItemTypeEventuallyConsistent({
          id: itemTypeId,
        });

        return itemType ? itemType.getEnabledRules() : null;
      },
      directives: { freshUntilAge: 20 },
    });
  },
);

export type GetEnabledRulesForItemTypeEventuallyConsistent = ReturnType<
  typeof makeGetEnabledRulesForItemTypeEventuallyConsistent
>;

export const makeGetSequelizeItemTypeEventuallyConsistent = inject(
  ['ItemTypeModel'],
  (ItemType) => {
    return cached({
      async producer(key: { id: string } | { name: string; orgId: string }) {
        return 'id' in key
          ? ItemType.findByPk(key.id)
          : ItemType.findOne({ where: { name: key.name, orgId: key.orgId } });
      },
      directives: { freshUntilAge: 10, maxStale: [0, 2, 2] },
    });
  },
);

export type GetSequelizeItemTypeEventuallyConsistent = ReturnType<
  typeof makeGetSequelizeItemTypeEventuallyConsistent
>;

export const makeGetItemTypesForOrgEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) => async (orgId: string) =>
    moderationConfigService.getItemTypes({
      orgId,
    }),
);

export type GetItemTypesForOrgEventuallyConsistent = ReturnType<
  typeof makeGetItemTypesForOrgEventuallyConsistent
>;

// TODO: this could probably be improved to increase cache hit rates, since
// rn the cache will only be used if all the ids have previously been fetched.
export const makeGetPoliciesForRulesEventuallyConsistent = inject(
  ['PolicyModel'],
  function (Policy) {
    return cached({
      keyGeneration: {
        toString: (ids: readonly string[]) => jsonStringify([...ids].sort()),
        fromString: (it) => jsonParse(it),
      },
      async producer(key) {
        return Policy.getPoliciesForRuleIds(key);
      },
      directives: { freshUntilAge: 120 },
    });
  },
);

export type GetPoliciesForRulesEventuallyConsistent = ReturnType<
  typeof makeGetPoliciesForRulesEventuallyConsistent
>;

export const makeGetActionsForRuleEventuallyConsistent = inject(
  ['ActionModel'],
  (Action) => {
    return cached({
      async producer(ruleId: string) {
        // This generates a pretty slow/overly-complex query, but I think it's
        // the best we can do with Sequelize. Eventually, we want to move off of
        // Sequelize, so we don't fetch full model instances + we cast the
        // result to be a plain data object, so that the rest of the code can't
        // depend on getting an Action model instance back, as that won't always
        // be the case.
        return Action.findAll({
          where: { '$rules.id$': ruleId },
          include: [{ association: 'rules', attributes: ['id'] }],
          raw: true,
        }) as Promise<Action[]>;
      },
      directives: { freshUntilAge: 30 },
    });
  },
);

export type GetActionsForRuleEventuallyConsistent = ReturnType<
  typeof makeGetActionsForRuleEventuallyConsistent
>;

export const makeGetLocationBankLocationsEventuallyConsistent = inject(
  ['LocationBankLocationModel'],
  (LocationBankLocation) => {
    return cached({
      async producer(bankId: string) {
        // NB: we use `raw: true` to get back plain JS objects, rather than
        // sequelize model instances. We do that because, with model instances,
        // every proprety access runs some extra getter code; see
        // https://github.com/sequelize/sequelize/blob/e77dcf78b341b62c97dbb29f16ce7a23f46ddc53/src/model.js#L42
        // This ends up killing the performance of our hot-path code that checks
        // whether a location is in each of these location areas.
        //
        // Meanwhile, we have to cast to LocationArea[] because findAll is still
        // typed (incorrectly) to return the model instance, even when `raw:
        // true` is provided.
        return LocationBankLocation.findAll({
          where: { bankId },
          raw: true,
        }) as Promise<LocationArea[]>;
      },
      directives(locations) {
        const numLocations = locations.length;
        const cacheTime = 15 + numLocations ** (1 / 3);
        const swrTime = numLocations ** (2 / 3);
        return { freshUntilAge: cacheTime, maxStale: [0, swrTime, swrTime] };
      },
      collapseOverlappingRequestsTime: 60,
    });
  },
);

export type GetLocationBankLocationsBankEventuallyConsistent = ReturnType<
  typeof makeGetLocationBankLocationsEventuallyConsistent
>;

export const makeGetTextBankStringsEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) => {
    return cached({
      async producer(input: { orgId: string; bankId: string }) {
        const { orgId, bankId } = input;
        const bank = await moderationConfigService.getTextBank({
          id: bankId,
          orgId,
        });

        return bank.strings;
      },
      directives: { freshUntilAge: 60, maxStale: [0, 5, 5] },
    });
  },
);

export type GetTextBankStringsEventuallyConsistent = ReturnType<
  typeof makeGetTextBankStringsEventuallyConsistent
>;

export const makeGetImageBankEventuallyConsistent = inject(
  ['HMAHashBankService'],
  (hmaService) => {
    return cached({
      async producer(input: { orgId: string; bankId: string }) {
        const { orgId, bankId } = input;
        return hmaService.getBankById(orgId, parseInt(bankId, 10));
      },
      directives: { freshUntilAge: 60, maxStale: [0, 5, 5] },
    });
  },
);

export type GetImageBankEventuallyConsistent = ReturnType<
  typeof makeGetImageBankEventuallyConsistent
>;

export const makeRecordRuleActionLimitUsage = inject(
  ['Sequelize', 'Tracer'],
  (db, tracer) => {
    /**
     * Record that each of the rules given by ruleIds has used up one of its
     * daily action runs, against its maxDailyActions.
     */
    async function recordRuleActionLimitUsage(ruleIds: readonly string[]) {
      if (ruleIds.length === 0) {
        return;
      }

      const today = getUtcDateOnlyString();
      await db.transactionWithRetry(async () => {
        // Using two queries like this isn't as efficient as, e.g.,
        // UPDATE `rules`
        //   SET `daily_actions_run` =
        //     IF(last_action_date != $1, 1, daily_actions_run + 1)
        //   SET `last_action_date` = $1
        //   WHERE `id` IN (...);
        // But it lets us keep the code in Sequelize, which is probably worth it.
        await db.Rule.increment(
          { dailyActionsRun: 1 },
          { where: { id: { [Op.in]: ruleIds }, lastActionDate: today } },
        );

        await db.Rule.update(
          { dailyActionsRun: 1, lastActionDate: today },
          {
            where: {
              id: { [Op.in]: ruleIds },
              lastActionDate: { [Op.ne]: today },
            },
          },
        );
      });
    }

    return tracer.traced(
      {
        resource: 'ruleEngine',
        operation: 'recordActionLimitUsage',
        attributesFromArgs: ([ruleIds]) => ({ ruleIds }),
      },
      recordRuleActionLimitUsage,
    );
  },
);

export type RecordRuleActionLimitUsage = (
  ruleIds: readonly string[],
) => Promise<void>;
