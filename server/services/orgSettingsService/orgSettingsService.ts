import { type Kysely } from 'kysely';
import { type JsonObject } from 'type-fest';
import { type ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';

import { inject } from '../../iocContainer/index.js';
import { cached } from '../../utils/caching.js';
import { MINUTE_MS } from '../../utils/time.js';

export type OrgSettingsPg = {
  'public.org_settings': {
    org_id: string;
    has_reporting_rules_enabled: boolean;
    has_appeals_enabled: boolean;
    appeal_callback_url: string | null;
    appeal_callback_headers: JsonObject | null;
    appeal_callback_body: JsonObject | null;
    partial_items_endpoint?: string;
    partial_items_request_headers: JsonObject | null;
    allow_multiple_policies_per_action: boolean;
    user_strike_ttl_days: number;
    is_demo_org: boolean;
  } & (
    | {
        saml_enabled: true;
        sso_url: string;
        // TODO: rename this to something more descriptive like sso_cert
        cert: string;
      }
    | {
        saml_enabled: false;
        sso_url: string | null;
        cert: string | null;
      }
  );
};
type PartialItemsInfo = {
  partialItemsEndpoint?: string;
  partialItemsRequestHeaders: JsonObject | null;
};

function makeOrgSettingsService(pgQuery: Kysely<OrgSettingsPg>) {
  const partialItemsEndpointCache = cached({
    async producer(orgId: string) {
      const row = await pgQuery
        .selectFrom('public.org_settings')
        .select(['partial_items_endpoint', 'partial_items_request_headers'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return row;
    },
    // NB: HOUR is in milliseconds but this library uses seconds for maxAge
    directives: { freshUntilAge: (MINUTE_MS * 5) / 1000 },
  });

  return {
    async upsertOrgDefaultSettings(opts: { orgId: string }) {
      const { orgId } = opts;
      await pgQuery
        .insertInto('public.org_settings')
        .values({
          org_id: orgId,
          has_reporting_rules_enabled: false,
          has_appeals_enabled: false,
          allow_multiple_policies_per_action: false,
          user_strike_ttl_days: 90,
          is_demo_org: false,
          saml_enabled: false,
          sso_url: null,
          cert: null,
          appeal_callback_url: null,
          appeal_callback_headers: null,
          appeal_callback_body: null,
        })
        .onConflict((oc) => oc.column('org_id').doNothing())
        .execute();
    },
    async hasReportingRulesEnabled(orgId: string) {
      const rows = await pgQuery
        .selectFrom('public.org_settings')
        .select(['has_reporting_rules_enabled'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return rows?.has_reporting_rules_enabled ?? false;
    },
    async hasAppealsEnabled(orgId: string) {
      const rows = await pgQuery
        .selectFrom('public.org_settings')
        .select(['has_appeals_enabled'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return rows?.has_appeals_enabled ?? false;
    },
    async allowMultiplePoliciesPerAction(orgId: string) {
      const rows = await pgQuery
        .selectFrom('public.org_settings')
        .select(['allow_multiple_policies_per_action'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return rows?.allow_multiple_policies_per_action ?? false;
    },
    async getAppealSettings(orgId: string) {
      const row = await pgQuery
        .selectFrom('public.org_settings')
        .select([
          'appeal_callback_url',
          'appeal_callback_headers',
          'appeal_callback_body',
        ])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return {
        appealCallbackUrl: row?.appeal_callback_url,
        appealCallbackHeaders: row?.appeal_callback_headers,
        appealCallbackBody: row?.appeal_callback_body,
      };
    },
    async userStrikeTTLInDays(orgId: string) {
      const rows = await pgQuery
        .selectFrom('public.org_settings')
        .select(['user_strike_ttl_days'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return rows?.user_strike_ttl_days ?? 90;
    },
    async updateUserStrikeTTL(input: { orgId: string; ttlDays: number }) {
      return pgQuery
        .updateTable('public.org_settings')
        .where('org_id', '=', input.orgId)
        .set({
          user_strike_ttl_days: input.ttlDays,
        })
        .returning(['user_strike_ttl_days'])
        .executeTakeFirst();
    },
    async updateAppealSettings(input: {
      orgId: string;
      callbackUrl: string | null;
      callbackHeaders: JsonObject | null;
      callbackBody: JsonObject | null;
    }) {
      const row = await pgQuery
        .updateTable('public.org_settings')
        .where('org_id', '=', input.orgId)
        .set({
          appeal_callback_headers: input.callbackHeaders,
          appeal_callback_url: input.callbackUrl,
          appeal_callback_body: input.callbackBody,
        })
        .returning([
          'appeal_callback_url',
          'appeal_callback_headers',
          'appeal_callback_body',
        ])
        .executeTakeFirst();
      return row;
    },
    async partialItemsInfo(
      orgId: string,
    ): Promise<ReadonlyObjectDeep<PartialItemsInfo> | undefined> {
      const partialItemsInfo = await partialItemsEndpointCache(orgId);
      return partialItemsInfo
        ? {
            partialItemsEndpoint: partialItemsInfo.partial_items_endpoint,
            partialItemsRequestHeaders:
              partialItemsInfo.partial_items_request_headers,
          }
        : undefined;
    },
    async getSamlSettings(orgId: string) {
      return pgQuery
        .selectFrom('public.org_settings')
        .select(['saml_enabled', 'sso_url', 'cert'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
    },
    async updateSamlSettings(input: {
      orgId: string;
      ssoUrl: string;
      cert: string;
    }) {
      try {
        await pgQuery
          .updateTable('public.org_settings')
          .where('org_id', '=', input.orgId)
          .set({ sso_url: input.ssoUrl, cert: input.cert })
          .executeTakeFirst();
        return true;
      } catch (e) {
        return false;
      }
    },
    async isDemoOrg(orgId: string) {
      const rows = await pgQuery
        .selectFrom('public.org_settings')
        .select(['is_demo_org'])
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      return rows?.is_demo_org ?? false;
    },
    async close() {
      await partialItemsEndpointCache.close();
    },
  };
}

export type OrgSettingsService = ReturnType<typeof makeOrgSettingsService>;

export default inject(['KyselyPg'], makeOrgSettingsService);
