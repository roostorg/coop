import { eq } from 'drizzle-orm';
import { type JsonObject } from 'type-fest';
import { type ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';

import { inject } from '../../iocContainer/utils.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
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
type OrgSettingsRow = OrgSettingsPg['public.org_settings'];
// Distributes over the saml_enabled union so callers keep its narrowing.
type SamlSettings = OrgSettingsRow extends infer R
  ? R extends OrgSettingsRow
    ? Pick<R, 'saml_enabled' | 'sso_url' | 'cert'>
    : never
  : never;

const orgSettings = schema.orgSettings;

type PartialItemsInfo = {
  partialItemsEndpoint?: string;
  partialItemsRequestHeaders: JsonObject | null;
};

function makeOrgSettingsService(pgQuery: CoopDb) {
  const partialItemsEndpointCache = cached({
    async producer(orgId: string) {
      const row = (
        await pgQuery
          .select({
            partial_items_endpoint: orgSettings.partialItemsEndpoint,
            partial_items_request_headers:
              orgSettings.partialItemsRequestHeaders,
          })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return row;
    },
    // NB: HOUR is in milliseconds but this library uses seconds for maxAge
    directives: { freshUntilAge: (MINUTE_MS * 5) / 1000 },
  });

  // Orgs created before `org_settings` defaults were seeded have no row, so a
  // plain UPDATE would silently affect 0 rows. Every settings mutation calls
  // this first to guarantee a row (with defaults) exists.
  async function ensureOrgSettingsRow(orgId: string) {
    const inserted = await pgQuery
      .insert(orgSettings)
      .values({
        orgId,
        hasReportingRulesEnabled: false,
        hasAppealsEnabled: false,
        allowMultiplePoliciesPerAction: false,
        userStrikeTtlDays: 90,
        samlEnabled: false,
        ssoUrl: null,
        cert: null,
        appealCallbackUrl: null,
        appealCallbackHeaders: null,
        appealCallbackBody: null,
      })
      .onConflictDoNothing({ target: orgSettings.orgId })
      .returning({ orgId: orgSettings.orgId });
    // If a row was actually inserted, drop the partial-items cache: it may have
    // memoized "no row" as undefined, which is now stale.
    if (inserted.length > 0) {
      await partialItemsEndpointCache.invalidate?.(orgId);
    }
  }

  return {
    async upsertOrgDefaultSettings(opts: { orgId: string }) {
      await ensureOrgSettingsRow(opts.orgId);
    },
    async hasReportingRulesEnabled(orgId: string) {
      const row = (
        await pgQuery
          .select({ value: orgSettings.hasReportingRulesEnabled })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return row?.value ?? false;
    },
    async hasAppealsEnabled(orgId: string) {
      const row = (
        await pgQuery
          .select({ value: orgSettings.hasAppealsEnabled })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return row?.value ?? false;
    },
    async allowMultiplePoliciesPerAction(orgId: string) {
      const row = (
        await pgQuery
          .select({ value: orgSettings.allowMultiplePoliciesPerAction })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return row?.value ?? false;
    },
    async getAppealSettings(orgId: string) {
      const row = (
        await pgQuery
          .select({
            appeal_callback_url: orgSettings.appealCallbackUrl,
            appeal_callback_headers: orgSettings.appealCallbackHeaders,
            appeal_callback_body: orgSettings.appealCallbackBody,
          })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return {
        appealCallbackUrl: row?.appeal_callback_url,
        appealCallbackHeaders: row?.appeal_callback_headers,
        appealCallbackBody: row?.appeal_callback_body,
      };
    },
    async userStrikeTTLInDays(orgId: string) {
      const row = (
        await pgQuery
          .select({ value: orgSettings.userStrikeTtlDays })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      return row?.value ?? 90;
    },
    async updateUserStrikeTTL(input: { orgId: string; ttlDays: number }) {
      await ensureOrgSettingsRow(input.orgId);
      const row = (
        await pgQuery
          .update(orgSettings)
          .set({ userStrikeTtlDays: input.ttlDays })
          .where(eq(orgSettings.orgId, input.orgId))
          .returning({ user_strike_ttl_days: orgSettings.userStrikeTtlDays })
      ).at(0);
      return row;
    },
    async updateAppealSettings(input: {
      orgId: string;
      callbackUrl: string | null;
      callbackHeaders: JsonObject | null;
      callbackBody: JsonObject | null;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      const row = (
        await pgQuery
          .update(orgSettings)
          .set({
            appealCallbackHeaders: input.callbackHeaders,
            appealCallbackUrl: input.callbackUrl,
            appealCallbackBody: input.callbackBody,
          })
          .where(eq(orgSettings.orgId, input.orgId))
          .returning({
            appeal_callback_url: orgSettings.appealCallbackUrl,
            appeal_callback_headers: orgSettings.appealCallbackHeaders,
            appeal_callback_body: orgSettings.appealCallbackBody,
          })
      ).at(0);
      return row;
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
      await pgQuery
        .update(orgSettings)
        .set({
          partialItemsEndpoint: input.endpoint,
          partialItemsRequestHeaders: input.requestHeaders,
        })
        .where(eq(orgSettings.orgId, input.orgId));
      // The read path is cached for 5 minutes; drop the entry so the new
      // values are visible immediately instead of after the TTL.
      await partialItemsEndpointCache.invalidate?.(input.orgId);
    },
    async getSamlSettings(orgId: string): Promise<SamlSettings | undefined> {
      const row = (
        await pgQuery
          .select({
            saml_enabled: orgSettings.samlEnabled,
            sso_url: orgSettings.ssoUrl,
            cert: orgSettings.cert,
          })
          .from(orgSettings)
          .where(eq(orgSettings.orgId, orgId))
          .limit(1)
      ).at(0);
      // The saml_settings_constraint check guarantees sso_url and cert are
      // set whenever saml_enabled is true; the Drizzle model can't express it.
      return row as SamlSettings | undefined;
    },
    async updateSamlSettings(input: {
      orgId: string;
      ssoUrl: string;
      cert: string;
    }) {
      try {
        await ensureOrgSettingsRow(input.orgId);
        await pgQuery
          .update(orgSettings)
          .set({ ssoUrl: input.ssoUrl, cert: input.cert })
          .where(eq(orgSettings.orgId, input.orgId));
        return true;
      } catch (e) {
        return false;
      }
    },
    async updateHasAppealsEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      await pgQuery
        .update(orgSettings)
        .set({ hasAppealsEnabled: input.enabled })
        .where(eq(orgSettings.orgId, input.orgId));
    },
    async updateHasReportingRulesEnabled(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await pgQuery
        .update(orgSettings)
        .set({ hasReportingRulesEnabled: input.enabled })
        .where(eq(orgSettings.orgId, input.orgId));
    },
    async updateAllowMultiplePoliciesPerAction(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await pgQuery
        .update(orgSettings)
        .set({ allowMultiplePoliciesPerAction: input.enabled })
        .where(eq(orgSettings.orgId, input.orgId));
    },
    async updateSamlEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      if (input.enabled) {
        const settings = (
          await pgQuery
            .select({ sso_url: orgSettings.ssoUrl, cert: orgSettings.cert })
            .from(orgSettings)
            .where(eq(orgSettings.orgId, input.orgId))
            .limit(1)
        ).at(0);
        if (!settings?.sso_url || !settings?.cert) {
          throw new Error(
            'Cannot enable SAML SSO without configuring SSO URL and certificate first',
          );
        }
      }
      await pgQuery
        .update(orgSettings)
        .set({ samlEnabled: input.enabled })
        .where(eq(orgSettings.orgId, input.orgId));
    },
    async close() {
      await partialItemsEndpointCache.close();
    },
  };
}

export type OrgSettingsService = ReturnType<typeof makeOrgSettingsService>;

export default inject(['DrizzlePg'], makeOrgSettingsService);
