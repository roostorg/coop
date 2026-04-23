/**
 * @fileoverview This defines a few separate "services" that can be injected
 * into the RuleEngine and other services in the POST /content hot path (like
 * the signal execution service) to enable those services to make the queries
 * they need to run a rule. Having these queries defined separately + injected
 * into the consumers gives us a cleaner place to add optimizations to the query
 * logic (i.e. run the queries against replicas, add caching, etc) and makes
 * the consumers much more unit testable.
 */
import { sql, type Kysely } from 'kysely';

import { inject } from '../iocContainer/index.js';
import { type LocationArea } from '../models/types/locationArea.js';
import { type CombinedPg } from '../services/combinedDbTypes.js';
import { cached } from '../utils/caching.js';
import { jsonParse, jsonStringify } from '../utils/encoding.js';
import { makeKyselyTransactionWithRetry } from '../utils/kyselyTransactionWithRetry.js';
import { getUtcDateOnlyString } from '../utils/time.js';

export const makeGetEnabledRulesForItemTypeEventuallyConsistent = inject(
  ['ModerationConfigService'],
  function (moderationConfigService) {
    return cached({
      async producer(itemTypeId: string) {
        return moderationConfigService.getEnabledRulesForItemType(itemTypeId);
      },
      directives: { freshUntilAge: 20 },
    });
  },
);

export type GetEnabledRulesForItemTypeEventuallyConsistent = ReturnType<
  typeof makeGetEnabledRulesForItemTypeEventuallyConsistent
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

export const makeGetPoliciesForRulesEventuallyConsistent = inject(
  ['ModerationConfigService'],
  function (moderationConfigService) {
    return cached({
      keyGeneration: {
        toString: (ids: readonly string[]) => jsonStringify([...ids].sort()),
        fromString: (it) => jsonParse(it),
      },
      async producer(key: readonly string[]) {
        return moderationConfigService.getPoliciesByRuleIds(key);
      },
      directives: { freshUntilAge: 120 },
    });
  },
);

export type GetPoliciesForRulesEventuallyConsistent = ReturnType<
  typeof makeGetPoliciesForRulesEventuallyConsistent
>;

export const makeGetActionsForRuleEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) => {
    return cached({
      keyGeneration: {
        toString: (key: { orgId: string; ruleId: string }) =>
          jsonStringify(key),
        fromString: (it) => jsonParse(it),
      },
      async producer(key: { orgId: string; ruleId: string }) {
        return moderationConfigService.getActionsForRuleId({
          orgId: key.orgId,
          ruleId: key.ruleId,
          readFromReplica: true,
        });
      },
      directives: { freshUntilAge: 30 },
    });
  },
);

export type GetActionsForRuleEventuallyConsistent = ReturnType<
  typeof makeGetActionsForRuleEventuallyConsistent
>;

export const makeGetLocationBankLocationsEventuallyConsistent = inject(
  ['KyselyPgReadReplica'],
  (db) => {
    return cached({
      async producer(bankId: string) {
        const rows = await db
          .selectFrom('public.location_bank_locations')
          .selectAll()
          .where('bank_id', '=', bankId)
          .execute();
        return rows.map(
          (r) =>
            ({
              id: r.id,
              name: r.name ?? undefined,
              geometry: r.geometry as LocationArea['geometry'],
              bounds: r.bounds as LocationArea['bounds'],
              googlePlaceInfo: r.google_place_info as LocationArea['googlePlaceInfo'],
            }) satisfies LocationArea,
        );
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
  ['KyselyPg', 'Tracer'],
  (db, tracer) => {
    const transactionWithRetry = makeKyselyTransactionWithRetry(
      db as Kysely<CombinedPg>,
    );

    async function recordRuleActionLimitUsage(ruleIds: readonly string[]) {
      if (ruleIds.length === 0) {
        return;
      }

      const today = String(getUtcDateOnlyString());
      await transactionWithRetry(async (trx) => {
        await trx
          .updateTable('public.rules')
          .set({
            daily_actions_run: sql`daily_actions_run + 1`,
          })
          .where('id', 'in', [...ruleIds])
          .where('last_action_date', '=', today)
          .execute();

        await trx
          .updateTable('public.rules')
          .set({
            daily_actions_run: 1,
            last_action_date: today,
          })
          .where('id', 'in', [...ruleIds])
          .where((eb) =>
            eb.or([
              eb('last_action_date', 'is', null),
              eb('last_action_date', '!=', today),
            ]),
          )
          .execute();
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
