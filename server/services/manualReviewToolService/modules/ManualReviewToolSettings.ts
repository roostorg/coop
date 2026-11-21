import {
  type Prisma,
  type PrismaPgClient,
} from '../../../storage/prisma/index.js';

type SettingsUpdate = Partial<
  Omit<Prisma.manual_review_tool_settingsUncheckedCreateInput, 'org_id'>
>;

const defaultSettings = {
  requires_policy_for_decisions: false,
  mrt_requires_decision_reason_on_action: false,
  mrt_requires_decision_reason_on_ignore: false,
  hide_skip_button_for_non_admins: false,
  preview_jobs_view_enabled: false,
  ignore_callback_url: null,
} satisfies SettingsUpdate;

export default class ManualReviewToolSettings {
  constructor(readonly prisma: PrismaPgClient) {}

  async upsertDefaultSettings(opts: { orgId: string }) {
    const { orgId } = opts;

    await this.prisma.manual_review_tool_settings.createMany({
      data: { org_id: orgId, ...defaultSettings },
      skipDuplicates: true,
    });
  }

  async getRequiresPolicyForDecisions(orgId: string) {
    const requiresPolicyForDecisionsRow =
      await this.prisma.manual_review_tool_settings.findUnique({
        select: { org_id: true, requires_policy_for_decisions: true },
        where: { org_id: orgId },
      });
    return (
      requiresPolicyForDecisionsRow?.requires_policy_for_decisions ?? false
    );
  }

  async getRequiresDecisionReason(orgId: string) {
    const decisionReasonRow =
      await this.prisma.manual_review_tool_settings.findUnique({
        select: { org_id: true, mrt_requires_decision_reason_on_action: true },
        where: { org_id: orgId },
      });
    return decisionReasonRow?.mrt_requires_decision_reason_on_action ?? false;
  }

  async getRequiresDecisionReasonOnIgnore(orgId: string) {
    const decisionReasonRow =
      await this.prisma.manual_review_tool_settings.findUnique({
        select: { org_id: true, mrt_requires_decision_reason_on_ignore: true },
        where: { org_id: orgId },
      });
    return decisionReasonRow?.mrt_requires_decision_reason_on_ignore ?? false;
  }

  async getHideSkipButtonForNonAdmins(orgId: string) {
    const hideSkipButtonRow =
      await this.prisma.manual_review_tool_settings.findUnique({
        select: { org_id: true, hide_skip_button_for_non_admins: true },
        where: { org_id: orgId },
      });
    return hideSkipButtonRow?.hide_skip_button_for_non_admins ?? false;
  }

  async getPreviewJobsViewEnabled(orgId: string) {
    const row = await this.prisma.manual_review_tool_settings.findUnique({
      select: { preview_jobs_view_enabled: true },
      where: { org_id: orgId },
    });
    return row?.preview_jobs_view_enabled ?? false;
  }

  async getIgnoreCallbackUrl(orgId: string) {
    const row = await this.prisma.manual_review_tool_settings.findUnique({
      select: { ignore_callback_url: true },
      where: { org_id: orgId },
    });
    return row?.ignore_callback_url ?? null;
  }

  // Orgs created before this table existed have no row, so a bare UPDATE would
  // match nothing and silently drop the change.
  private async upsertSettings(
    orgId: string,
    changes: SettingsUpdate,
  ): Promise<void> {
    await this.prisma.manual_review_tool_settings.upsert({
      where: { org_id: orgId },
      create: { org_id: orgId, ...defaultSettings, ...changes },
      update: changes,
    });
  }

  async updateRequiresPolicyForDecisions(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      requires_policy_for_decisions: enabled,
    });
  }

  async updateRequiresDecisionReason(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      mrt_requires_decision_reason_on_action: enabled,
    });
  }

  async updateRequiresDecisionReasonOnIgnore(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      mrt_requires_decision_reason_on_ignore: enabled,
    });
  }

  async updateHideSkipButtonForNonAdmins(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, {
      hide_skip_button_for_non_admins: enabled,
    });
  }

  async updatePreviewJobsViewEnabled(orgId: string, enabled: boolean) {
    await this.upsertSettings(orgId, { preview_jobs_view_enabled: enabled });
  }

  async updateIgnoreCallbackUrl(orgId: string, url: string | null) {
    await this.upsertSettings(orgId, { ignore_callback_url: url });
  }
}
