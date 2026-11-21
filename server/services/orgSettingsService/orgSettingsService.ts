import { type JsonObject } from 'type-fest';
import { type ReadonlyObjectDeep } from 'type-fest/source/readonly-deep.js';

import { inject } from '../../iocContainer/utils.js';
import { Prisma, type PrismaPgClient } from '../../storage/prisma/index.js';
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

// SQL NULL for a nullable JSON column (a plain `null` would be rejected).
function jsonOrDbNull(value: JsonObject | null) {
  return value ?? Prisma.DbNull;
}

type PartialItemsInfo = {
  partialItemsEndpoint?: string;
  partialItemsRequestHeaders: JsonObject | null;
};

const APPEAL_SETTINGS_SELECT = {
  appeal_callback_url: true,
  appeal_callback_headers: true,
  appeal_callback_body: true,
} as const;

function makeOrgSettingsService(prisma: PrismaPgClient) {
  const partialItemsEndpointCache = cached({
    async producer(orgId: string) {
      const row = await prisma.org_settings.findUnique({
        select: {
          partial_items_endpoint: true,
          partial_items_request_headers: true,
        },
        where: { org_id: orgId },
      });
      return row == null
        ? undefined
        : {
            partial_items_endpoint: row.partial_items_endpoint,
            // JSON columns come back as `JsonValue`; this one holds an object.
            partial_items_request_headers:
              row.partial_items_request_headers as JsonObject | null,
          };
    },
    // NB: HOUR is in milliseconds but this library uses seconds for maxAge
    directives: { freshUntilAge: (MINUTE_MS * 5) / 1000 },
  });

  // Orgs created before `org_settings` defaults were seeded have no row, so a
  // plain UPDATE would silently affect 0 rows. Every settings mutation calls
  // this first to guarantee a row (with defaults) exists.
  async function ensureOrgSettingsRow(orgId: string) {
    const result = await prisma.org_settings.createMany({
      data: {
        org_id: orgId,
        has_reporting_rules_enabled: false,
        has_appeals_enabled: false,
        allow_multiple_policies_per_action: false,
        user_strike_ttl_days: 90,
        saml_enabled: false,
        sso_url: null,
        cert: null,
        appeal_callback_url: null,
        appeal_callback_headers: Prisma.DbNull,
        appeal_callback_body: Prisma.DbNull,
      },
      skipDuplicates: true,
    });
    // If a row was actually inserted, drop the partial-items cache: it may have
    // memoized "no row" as undefined, which is now stale.
    if (result.count > 0) {
      await partialItemsEndpointCache.invalidate?.(orgId);
    }
  }

  return {
    async upsertOrgDefaultSettings(opts: { orgId: string }) {
      await ensureOrgSettingsRow(opts.orgId);
    },
    async hasReportingRulesEnabled(orgId: string) {
      const rows = await prisma.org_settings.findUnique({
        select: { has_reporting_rules_enabled: true },
        where: { org_id: orgId },
      });
      return rows?.has_reporting_rules_enabled ?? false;
    },
    async hasAppealsEnabled(orgId: string) {
      const rows = await prisma.org_settings.findUnique({
        select: { has_appeals_enabled: true },
        where: { org_id: orgId },
      });
      return rows?.has_appeals_enabled ?? false;
    },
    async allowMultiplePoliciesPerAction(orgId: string) {
      const rows = await prisma.org_settings.findUnique({
        select: { allow_multiple_policies_per_action: true },
        where: { org_id: orgId },
      });
      return rows?.allow_multiple_policies_per_action ?? false;
    },
    async getAppealSettings(orgId: string) {
      const row = await prisma.org_settings.findUnique({
        select: APPEAL_SETTINGS_SELECT,
        where: { org_id: orgId },
      });
      return {
        appealCallbackUrl: row?.appeal_callback_url,
        appealCallbackHeaders: row?.appeal_callback_headers as
          JsonObject | null | undefined,
        appealCallbackBody: row?.appeal_callback_body as
          JsonObject | null | undefined,
      };
    },
    async userStrikeTTLInDays(orgId: string) {
      const rows = await prisma.org_settings.findUnique({
        select: { user_strike_ttl_days: true },
        where: { org_id: orgId },
      });
      return rows?.user_strike_ttl_days ?? 90;
    },
    async updateUserStrikeTTL(input: { orgId: string; ttlDays: number }) {
      await ensureOrgSettingsRow(input.orgId);
      const [row] = await prisma.org_settings.updateManyAndReturn({
        where: { org_id: input.orgId },
        data: { user_strike_ttl_days: input.ttlDays },
        select: { user_strike_ttl_days: true },
      });
      return row as Pick<OrgSettingsRow, 'user_strike_ttl_days'> | undefined;
    },
    async updateAppealSettings(input: {
      orgId: string;
      callbackUrl: string | null;
      callbackHeaders: JsonObject | null;
      callbackBody: JsonObject | null;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      const [row] = await prisma.org_settings.updateManyAndReturn({
        where: { org_id: input.orgId },
        data: {
          appeal_callback_headers: jsonOrDbNull(input.callbackHeaders),
          appeal_callback_url: input.callbackUrl,
          appeal_callback_body: jsonOrDbNull(input.callbackBody),
        },
        select: APPEAL_SETTINGS_SELECT,
      });
      return row as
        | Pick<
            OrgSettingsRow,
            | 'appeal_callback_url'
            | 'appeal_callback_headers'
            | 'appeal_callback_body'
          >
        | undefined;
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
      await prisma.org_settings.updateMany({
        where: { org_id: input.orgId },
        data: {
          partial_items_endpoint: input.endpoint,
          partial_items_request_headers: jsonOrDbNull(input.requestHeaders),
        },
      });
      // The read path is cached for 5 minutes; drop the entry so the new
      // values are visible immediately instead of after the TTL.
      await partialItemsEndpointCache.invalidate?.(input.orgId);
    },
    async getSamlSettings(orgId: string) {
      const row = await prisma.org_settings.findUnique({
        select: { saml_enabled: true, sso_url: true, cert: true },
        where: { org_id: orgId },
      });
      // The DB CHECK constraint guarantees `sso_url`/`cert` are set when
      // `saml_enabled`; Prisma can't express that union, so restore it here.
      return row ?? undefined;
    },
    async updateSamlSettings(input: {
      orgId: string;
      ssoUrl: string;
      cert: string;
    }) {
      try {
        await ensureOrgSettingsRow(input.orgId);
        await prisma.org_settings.updateMany({
          where: { org_id: input.orgId },
          data: { sso_url: input.ssoUrl, cert: input.cert },
        });
        return true;
      } catch (e) {
        return false;
      }
    },
    async updateHasAppealsEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      await prisma.org_settings.updateMany({
        where: { org_id: input.orgId },
        data: { has_appeals_enabled: input.enabled },
      });
    },
    async updateHasReportingRulesEnabled(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await prisma.org_settings.updateMany({
        where: { org_id: input.orgId },
        data: { has_reporting_rules_enabled: input.enabled },
      });
    },
    async updateAllowMultiplePoliciesPerAction(input: {
      orgId: string;
      enabled: boolean;
    }) {
      await ensureOrgSettingsRow(input.orgId);
      await prisma.org_settings.updateMany({
        where: { org_id: input.orgId },
        data: { allow_multiple_policies_per_action: input.enabled },
      });
    },
    async updateSamlEnabled(input: { orgId: string; enabled: boolean }) {
      await ensureOrgSettingsRow(input.orgId);
      if (input.enabled) {
        const settings = await prisma.org_settings.findUnique({
          select: { sso_url: true, cert: true },
          where: { org_id: input.orgId },
        });
        if (!settings?.sso_url || !settings?.cert) {
          throw new Error(
            'Cannot enable SAML SSO without configuring SSO URL and certificate first',
          );
        }
      }
      await prisma.org_settings.updateMany({
        where: { org_id: input.orgId },
        data: { saml_enabled: input.enabled },
      });
    },
    async close() {
      await partialItemsEndpointCache.close();
    },
  };
}

export type OrgSettingsService = ReturnType<typeof makeOrgSettingsService>;

export default inject(['PrismaPg'], makeOrgSettingsService);
