import { type Kysely } from 'kysely';

import { type ManualReviewToolServicePg } from '../dbTypes.js';

export default class ManualReviewToolSettings {
  constructor(readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async upsertDefaultSettings(opts: { orgId: string }) {
    const { orgId } = opts;

    await this.pgQuery
      .insertInto('manual_review_tool.manual_review_tool_settings')
      .values({
        org_id: orgId,
        requires_policy_for_decisions: false,
        mrt_requires_decision_reason: false,
        hide_skip_button_for_non_admins: false,
        preview_jobs_view_enabled: false,
        ignore_callback_url: null,
        default_job_sort_order: 'DESC',
      })
      .onConflict((oc) => oc.column('org_id').doNothing())
      .execute();
  }

  async getRequiresPolicyForDecisions(orgId: string) {
    const requiresPolicyForDecisionsRow = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['org_id', 'requires_policy_for_decisions'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return (
      requiresPolicyForDecisionsRow?.requires_policy_for_decisions ?? false
    );
  }

  async getRequiresDecisionReason(orgId: string) {
    const decisionReasonRow = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['org_id', 'mrt_requires_decision_reason'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return decisionReasonRow?.mrt_requires_decision_reason ?? false;
  }

  async getHideSkipButtonForNonAdmins(orgId: string) {
    const hideSkipButtonRow = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['org_id', 'hide_skip_button_for_non_admins'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return hideSkipButtonRow?.hide_skip_button_for_non_admins ?? false;
  }

  async getPreviewJobsViewEnabled(orgId: string) {
    const row = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['preview_jobs_view_enabled'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return row?.preview_jobs_view_enabled ?? false;
  }

  async getIgnoreCallbackUrl(orgId: string) {
    const row = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['ignore_callback_url'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return row?.ignore_callback_url ?? null;
  }

  async updateRequiresPolicyForDecisions(orgId: string, enabled: boolean) {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ requires_policy_for_decisions: enabled })
      .execute();
  }

  async updateRequiresDecisionReason(orgId: string, enabled: boolean) {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ mrt_requires_decision_reason: enabled })
      .execute();
  }

  async updateHideSkipButtonForNonAdmins(orgId: string, enabled: boolean) {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ hide_skip_button_for_non_admins: enabled })
      .execute();
  }

  async updatePreviewJobsViewEnabled(orgId: string, enabled: boolean) {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ preview_jobs_view_enabled: enabled })
      .execute();
  }

  async updateIgnoreCallbackUrl(orgId: string, url: string | null) {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ ignore_callback_url: url })
      .execute();
  }

  async getDefaultJobSortOrder(orgId: string) {
    const row = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_tool_settings')
      .select(['default_job_sort_order'])
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return row?.default_job_sort_order ?? 'DESC';
  }

  async updateDefaultJobSortOrder(orgId: string, sortOrder: 'ASC' | 'DESC') {
    await this.pgQuery
      .updateTable('manual_review_tool.manual_review_tool_settings')
      .where('org_id', '=', orgId)
      .set({ default_job_sort_order: sortOrder })
      .execute();
  }
}
