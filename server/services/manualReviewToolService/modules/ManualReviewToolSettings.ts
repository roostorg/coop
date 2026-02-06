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
        ignore_callback_url: undefined,
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
}
