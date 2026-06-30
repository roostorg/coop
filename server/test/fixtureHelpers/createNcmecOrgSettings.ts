import { type Kysely } from 'kysely';

import { type NcmecReportingServicePg } from '../../services/ncmecService/index.js';

export type NcmecOrgSettingsRow = {
  orgId: string;
  username: string;
  password: string;
  contactEmail?: string;
  moreInfoUrl?: string;
  companyTemplate: string;
  legalUrl: string;
  ncmecPreservationEndpoint?: string;
  /** Intentionally omitted by default: when unset, getNCMECAdditionalInfo
   * returns default data without a network call (ncmecReporting.ts:1478),
   * so the test needs no webhook stub. */
  ncmecAdditionalInfoEndpoint?: string;
  defaultInternetDetailType?: string;
};

export default async function createNcmecOrgSettings(
  kysely: Kysely<NcmecReportingServicePg>,
  row: NcmecOrgSettingsRow,
): Promise<{ cleanup: () => Promise<void> }> {
  await kysely
    .insertInto('ncmec_reporting.ncmec_org_settings')
    .values({
      org_id: row.orgId,
      username: row.username,
      password: row.password,
      // These columns are typed `string | undefined` (optional) in dbTypes.ts,
      // so omit rather than null when not provided.
      ...(row.contactEmail ? { contact_email: row.contactEmail } : {}),
      ...(row.moreInfoUrl ? { more_info_url: row.moreInfoUrl } : {}),
      company_template: row.companyTemplate,
      legal_url: row.legalUrl,
      ...(row.ncmecPreservationEndpoint
        ? { ncmec_preservation_endpoint: row.ncmecPreservationEndpoint }
        : {}),
      ...(row.ncmecAdditionalInfoEndpoint
        ? { ncmec_additional_info_endpoint: row.ncmecAdditionalInfoEndpoint }
        : {}),
      // CHECK constraint: both policy/action arrays NULL together.
      policies_applied_to_actions_run_on_report_creation: null,
      actions_to_run_upon_report_creation: null,
      // default_internet_detail_type is typed (string | null) on
      // NcmecReportingServicePg; pass through when provided.
      default_internet_detail_type: row.defaultInternetDetailType ?? null,
    })
    .execute();

  return {
    async cleanup() {
      await kysely
        .deleteFrom('ncmec_reporting.ncmec_org_settings')
        .where('org_id', '=', row.orgId)
        .execute();
    },
  };
}
