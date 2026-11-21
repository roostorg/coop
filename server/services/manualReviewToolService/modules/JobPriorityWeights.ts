import { eq, sql } from 'drizzle-orm';

import { schema, type CoopDb } from '../../../storage/postgres/drizzle.js';
import { type JobPropertyKey } from './JobPriority.js';

const { jobPriorityWeights } = schema;

// Persistence for the per-org WEIGHTED sort-mode weights. Validation
// (finite, non-negative, no duplicate properties) happens at the service
// boundary in ManualReviewToolService.setJobPriorityWeights.
export default class JobPriorityWeights {
  constructor(private readonly db: CoopDb) {}

  async loadForOrg(orgId: string): Promise<Map<JobPropertyKey, number>> {
    const rows = await this.db
      .select({
        property: jobPriorityWeights.property,
        weight: jobPriorityWeights.weight,
      })
      .from(jobPriorityWeights)
      .where(eq(jobPriorityWeights.orgId, orgId));
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
    await this.db
      .insert(jobPriorityWeights)
      .values(
        weights.map((w) => ({
          orgId,
          weight: w.weight,
          property: String(w.property),
        })),
      )
      .onConflictDoUpdate({
        target: [jobPriorityWeights.orgId, jobPriorityWeights.property],
        set: {
          weight: sql`excluded.weight`,
          updatedAt: new Date(),
        },
      });
  }
}
