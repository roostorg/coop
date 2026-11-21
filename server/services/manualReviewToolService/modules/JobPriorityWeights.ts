import { type PrismaPgClient } from '../../../storage/prisma/index.js';
import { makePrismaTransactionWithRetry } from '../../../utils/prismaTransactionWithRetry.js';
import { type JobPropertyKey } from './JobPriority.js';

// Persistence for the per-org WEIGHTED sort-mode weights. Validation
// (finite, non-negative, no duplicate properties) happens at the service
// boundary in ManualReviewToolService.setJobPriorityWeights.
export default class JobPriorityWeights {
  private readonly transactionWithRetry: ReturnType<
    typeof makePrismaTransactionWithRetry
  >;

  constructor(private readonly prisma: PrismaPgClient) {
    this.transactionWithRetry = makePrismaTransactionWithRetry(prisma);
  }

  async loadForOrg(orgId: string): Promise<Map<JobPropertyKey, number>> {
    const rows = await this.prisma.job_priority_weights.findMany({
      select: { property: true, weight: true },
      where: { org_id: orgId },
    });
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
    // Prisma has no multi-row upsert, so this is one INSERT ... ON CONFLICT
    // per weight, wrapped in a transaction to stay all-or-nothing.
    const now = new Date();
    await this.transactionWithRetry(async (tx) => {
      for (const w of weights) {
        const property = String(w.property);
        const weight = String(w.weight);
        await tx.job_priority_weights.upsert({
          where: { org_id_property: { org_id: orgId, property } },
          create: { org_id: orgId, property, weight },
          update: { weight, updated_at: now },
        });
      }
    });
  }
}
