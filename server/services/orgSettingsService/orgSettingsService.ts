import { type JsonObject } from 'type-fest';
import { type ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { inject } from '../../iocContainer/utils.js';
import { managerOf, type TypeormDb } from '../../storage/typeorm/db.js';
import { OrgSettings } from '../../storage/typeorm/entities/index.js';
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
    partial_items_endpoint: string | null;
    partial_items_request_headers: JsonObject | null;
    allow_multiple_policies_per_action: boolean;
    user_strike_ttl_days: number;
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

type OrgSettingsRow = OrgSettingsPg['public.org_settings'];

function makeOrgSettingsService(db: TypeormDb) {
  // The entity types the JSON columns as `unknown` and the booleans as
  // nullable (that's what the DDL says); `OrgSettingsPg` is the app's view.
  async function selectSettings<K extends keyof OrgSettingsRow>(
    orgId: string,
    columns: readonly K[],
  ): Promise<Pick<OrgSettingsRow, K> | undefined> {
    const manager = await managerOf(db);
    const row = await manager.findOne(OrgSettings, {
      select: Object.fromEntries(columns.map((c) => [c, true])),
      where: { org_id: orgId },
    });
    return (row ?? undefined) as Pick<OrgSettingsRow, K> | undefined;
  }

  async function updateSettings<K extends keyof OrgSettingsRow>(
    orgId: string,
    set: Partial<OrgSettingsRow>,
    returning?: readonly K[],
  ): Promise<Pick<OrgSettingsRow, K> | undefined> {
    const manager = await managerOf(db);
    const qb = manager
      .createQueryBuilder()
      .update(OrgSettings)
      // The entity's JSON columns are `unknown`, and TypeORM's update type
      // rejects `null` for those; `OrgSettingsRow` is the precise shape.
      .set(set as QueryDeepPartialEntity<OrgSettings>)
      .where('org_id = :orgId', { orgId });
    if (returning === undefined) {
      await qb.execute();
      return undefined;
    }
    const result = await qb.returning([...returning]).execute();
    return (result.raw as Pick<OrgSettingsRow, K>[])[0];
  }

  const partialItemsEndpointCache = cached({
    async producer(orgId: string) {
      return selectSettings(orgId, [
        'partial_items_endpoint',
        'partial_items_request_headers',
      ]);
    },
    // NB: HOUR is in milliseconds but this library uses seconds for maxAge
    directives: { freshUntilAge: (MINUTE_MS * 5) / 1000 },
  });

  // Orgs created before `org_settings` defaults were seeded have no row, so a
  // plain UPDATE would silently affect 0 rows. Every settings mutation calls
  // this first to guarantee a row (with defaults) exists.
  async function ensureOrgSettingsRow(orgId: string) {
    const manager = await managerOf(db);
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(OrgSettings)
      .values({
        org_id: orgId,
        has_reporting_rules_enabled: false,
        has_appeals_enabled: false,
        allow_multiple_policies_per_action: false,
        user_strike_ttl_days: 90,
        saml_enabled: false,
        sso_url: null,
        cert: null,
        appeal_callback_url: null,
        // appeal_callback_headers/body are left to their NULL default; TypeORM
        // won't type-check an explicit null for an `unknown` JSON column.
      })
      .orIgnore()
      // Without this, TypeORM appends RETURNING for every column with a DB
      // default and re-reads them, so an ignored insert can't be told apart.
      .returning(['org_id'])
      .updateEntity(false)
      .execute();
    // If a row was actually inserted, drop the partial-items cache: it may have
    // memoized "no row" as undefined, which is now stale.
    if ((result.raw as unknown[]).length > 0) {
      await partialItemsEndpointCache.invalidate?.(orgId);
    }
  }

  return {
    async upsertOrgDefaultSettings(opts: { orgId: string }) {
      await ensureOrgSettingsRow(opts.orgId);
    },
    async hasReportingRulesEnabled(orgId: string) {
      const rows = await selectSettings(orgId, ['has_reporting_rules_enabled']);
      return rows?.has_reporting_rules_enabled ?? false;
    },
    async hasAppealsEnabled(orgId: string) {
      const rows = await selectSettings(orgId, ['has_appeals_enabled']);
      return rows?.has_appeals_enabled ?? false;
    },
    async allowMultiplePoliciesPerAction(orgId: string) {
      const rows = await selectSettings(orgId, [
        'allow_multiple_policies_per_action',
      ]);
      return rows?.allow_multiple_policies_per_action ?? false;
    },
    async getAppealSettings(orgId: string) {
      const row = await selectSettings(orgId, [
        'appeal_callback_url',
        'appeal_callback_headers',
        'appeal_callback_body',
      ]);
      return {
        appealCallbackUrl: row?.appeal_callback_url,
        appealCallbackHeaders: row?.appeal_callback_headers,
        appealCallbackBody: row?.appeal_callback_body,
      };
    },
    async userStrikeTTLInDays(orgId: string) {
      const rows = await selectSettings(orgId, ['user_strike_ttl_days']);
      return rows?.user_strike_ttl_days ?? 90;
    },
    async updateUserStrikeTTL(input: { orgId: string; ttlDays: number }) {
      await ensureOrgSettingsRow(input.orgId);
      return updateSettings(
        input.orgId,
        { user_strike_ttl_days: input.ttlDays },
        ['user_strike_ttl_days'],
      );
    },
    async updateAppealSettings(input: {
      orgId: string;
      callbackUrl: string | null;
      callbackHeaders: JsonObject | null;
      callbackBody: JsonObject | null;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      return updateSettings(
        input.orgId,
        {
          appeal_callback_headers: input.callbackHeaders,
          appeal_callback_url: input.callbackUrl,
          appeal_callback_body: input.callbackBody,
        },
        [
          'appeal_callback_url',
          'appeal_callback_headers',
          'appeal_callback_body',
        ],
      );
    },
    async partialItemsInfo(
      orgId: string,
    ): Promise<ReadonlyObjectDeep<PartialItemsInfo> | undefined> {
      const partialItemsInfo = await partialItemsEndpointCache(orgId);
      return partialItemsInfo
        ? {
            partialItemsEndpoint:
              partialItemsInfo.partial_items_endpoint ?? undefined,
            partialItemsRequestHeaders:
              partialItemsInfo.partial_items_request_headers,
          }
        : undefined;
    },
    async updatePartialItemsSettings(input: {
      orgId: string;
      endpoint: string | null;
      requestHeaders: JsonObject | null;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await updateSettings(input.orgId, {
        partial_items_endpoint: input.endpoint,
        partial_items_request_headers: input.requestHeaders,
      });
      // The read path is cached for 5 minutes; drop the entry so the new
      // values are visible immediately instead of after the TTL.
      await partialItemsEndpointCache.invalidate?.(input.orgId);
    },
    async getSamlSettings(orgId: string) {
      return selectSettings(orgId, ['saml_enabled', 'sso_url', 'cert']);
    },
    async updateSamlSettings(input: {
      orgId: string;
      ssoUrl: string;
      cert: string;
    }) {
      try {
        await ensureOrgSettingsRow(input.orgId);
        await updateSettings(input.orgId, {
          sso_url: input.ssoUrl,
          cert: input.cert,
        });
        return true;
      } catch (e) {
        return false;
      }
    },
    async updateHasAppealsEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      await updateSettings(input.orgId, { has_appeals_enabled: input.enabled });
    },
    async updateHasReportingRulesEnabled(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await updateSettings(input.orgId, {
        has_reporting_rules_enabled: input.enabled,
      });
    },
    async updateAllowMultiplePoliciesPerAction(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await updateSettings(input.orgId, {
        allow_multiple_policies_per_action: input.enabled,
      });
    },
    async updateSamlEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      if (input.enabled) {
        const settings = await selectSettings(input.orgId, ['sso_url', 'cert']);
        if (!settings?.sso_url || !settings.cert) {
          throw new Error(
            'Cannot enable SAML SSO without configuring SSO URL and certificate first',
          );
        }
      }
      await updateSettings(input.orgId, { saml_enabled: input.enabled });
    },
    async close() {
      await partialItemsEndpointCache.close();
    },
  };
}

export type OrgSettingsService = ReturnType<typeof makeOrgSettingsService>;

export default inject(['TypeormPg'], makeOrgSettingsService);
