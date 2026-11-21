import { eq } from 'drizzle-orm';

import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';

const { manualReviewToolSettings: settings } = schema;

type SettingsUpdate = Partial<Omit<typeof settings.$inferInsert, 'orgId'>>;

const defaultSettings = {
  requiresPolicyForDecisions: false,
  mrtRequiresDecisionReasonOnAction: false,
  mrtRequiresDecisionReasonOnIgnore: false,
  hideSkipButtonForNonAdmins: false,
  previewJobsViewEnabled: false,
  ignoreCallbackUrl: null,
} satisfies SettingsUpdate;

export default class ManualReviewToolSettings {
  constructor(readonly db: CoopDb) {}

  async upsertDefaultSettings(opts: { orgId: string }) {
    const { orgId } = opts;

    await this.db
      .insert(settings)
      .values({ orgId, ...defaultSettings })
      .onConflictDoNothing({ target: settings.orgId });
  }

  async #getSettingsRow(orgId: string) {
    const row = (
      await this.db
        .select()
        .from(settings)
        .where(eq(settings.orgId, orgId))
        .limit(1)
    ).at(0);
    return row;
  }

  async getRequiresPolicyForDecisions(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.requiresPolicyForDecisions ?? false;
  }

  async getRequiresDecisionReason(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.mrtRequiresDecisionReasonOnAction ?? false;
  }

  async getRequiresDecisionReasonOnIgnore(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.mrtRequiresDecisionReasonOnIgnore ?? false;
  }

  async getHideSkipButtonForNonAdmins(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.hideSkipButtonForNonAdmins ?? false;
  }

  async getPreviewJobsViewEnabled(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.previewJobsViewEnabled ?? false;
  }

  async getIgnoreCallbackUrl(orgId: string) {
    const row = await this.#getSettingsRow(orgId);
    return row?.ignoreCallbackUrl ?? null;
  }

  // Orgs created before this table existed have no row, so a bare UPDATE would
  // match nothing and silently drop the change.
  private async upsertSettings(
    orgId: string,
    changes: SettingsUpdate,
  ): Promise<void> {
    await this.db
      .insert(settings)
      .values({ orgId, ...defaultSettings, ...changes })
      .onConflictDoUpdate({ target: settings.orgId, set: changes });
  }

  async updateRequiresPolicyForDecisions(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, { requiresPolicyForDecisions: enabled });
  }

  async updateRequiresDecisionReason(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      mrtRequiresDecisionReasonOnAction: enabled,
    });
  }

  async updateRequiresDecisionReasonOnIgnore(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      mrtRequiresDecisionReasonOnIgnore: enabled,
    });
  }

  async updateHideSkipButtonForNonAdmins(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, { hideSkipButtonForNonAdmins: enabled });
  }

  async updatePreviewJobsViewEnabled(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, { previewJobsViewEnabled: enabled });
  }

  async updateIgnoreCallbackUrl(orgId: string, url: string | null) {
    await this.upsertSettings(orgId, { ignoreCallbackUrl: url });
  }
}
