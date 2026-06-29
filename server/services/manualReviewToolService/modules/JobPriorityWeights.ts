import { type Kysely } from 'kysely';

import { type ManualReviewToolServicePg } from '../dbTypes.js';
import { type JobPropertyKey } from './JobPriority.js';

export default class JobPriorityWeights {
  constructor(private readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

  async loadForOrg(orgId: string): Promise<Map<JobPropertyKey, number>> {
    const rows = await this.pgQuery
      .selectFrom('manual_review_tool.job_priority_weights')
      .select(['property', 'weight'])
      .where('org_id', '=', orgId)
      .execute();
    return new Map(
      rows.map((r) => [r.property as JobPropertyKey, Number(r.weight)]),
    );
  }

  async upsertForOrg(
    orgId: string,
    weights: ReadonlyArray<{ property: JobPropertyKey; weight: number }>,
  ): Promise<void> {
    if (weights.length === 0) {
      return;
    }
    await this.pgQuery
      .insertInto('manual_review_tool.job_priority_weights')
      .values(
        weights.map((w) => ({
          org_id: orgId,
          weight: String(w.weight),
          property: String(w.property),
        })),
      )
      .onConflict((oc) =>
        oc.columns(['org_id', 'property']).doUpdateSet({
          weight: (eb) => eb.ref('excluded.weight'),
          updated_at: new Date(),
        }),
      )
      .execute();
  }
}
