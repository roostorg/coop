/**
 * Integration test for #342: background jobs do the right thing.
 *
 * Each scenario runs a background job twice against real Postgres + (where
 * relevant) ClickHouse and asserts the job's idempotency invariants:
 *
 *   1. First run picks up all eligible rows (no skip)
 *   2. Second run with the same input is a no-op (no double-fire)
 *   3. After new input lands, the next run picks up exactly the new rows
 *      (no skip, no double-fire)
 *
 * In scope for this PR:
 *   - RefreshMRTDecisionsMaterializedViewJob
 *   - DetectRulePassRateAnomaliesJob
 *
 * Deferred (see the issue thread): RetryFailedNcmecDecisionsJob — needs an
 * outbound-HTTP simulator before the retry invariants can be checked
 * meaningfully against a real stack.
 *
 * Run with: pnpm run test:integ
 * Requires: `pnpm run up && pnpm run db:update`
 */
import { count, eq } from 'drizzle-orm';
import { uid } from 'uid';
import { v4 as uuidv4 } from 'uuid';

import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
} from '../../services/moderationConfigService/index.js';
import { schema, type CoopDb } from '../../storage/postgres/drizzle.js';
import { jsonStringify } from '../../utils/encoding.js';
import createOrg from '../fixtureHelpers/createOrg.js';
import createUser from '../fixtureHelpers/createUser.js';
import {
  makeIntegrationServer,
  type IntegrationServer,
} from './setupIntegrationServer.js';

describe('Refresh MRT decisions materialized view job (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let coopUserCleanup: (() => Promise<unknown>) | undefined;
  let reviewerId: string;

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        DrizzlePg: harness.deps.DrizzlePg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;

    // Reviewer for the seeded decisions; reviewer_id must reference a real
    // coop user.
    const userFixture = await createUser(harness.deps.DrizzlePg, orgId);
    reviewerId = userFixture.user.id;
    coopUserCleanup = userFixture.cleanup;
  }, 60_000);

  afterAll(async () => {
    const runStep = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[background-jobs.integ] cleanup step failed', err);
      }
    };
    try {
      // Best effort: clean any decisions / materialized rows we seeded for
      // this org so a subsequent run isn't affected by leftovers.
      if (harness) {
        await runStep(async () => {
          await harness!.deps.DrizzlePg.delete(
            schema.manualReviewDecisions,
          ).where(eq(schema.manualReviewDecisions.orgId, orgId));
        });
        await runStep(async () => {
          await harness!.deps.DrizzlePg.delete(
            schema.dimMrtDecisionsMaterialized,
          ).where(eq(schema.dimMrtDecisionsMaterialized.orgId, orgId));
        });
      }
      await runStep(coopUserCleanup);
      await runStep(orgCleanup);
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('first run materializes all decisions, re-runs do not duplicate, new decisions are picked up', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const { DrizzlePg, RefreshMRTDecisionsMaterializedViewJob } = harness.deps;

    const countMaterializedForOrg = async () => {
      const materialized = schema.dimMrtDecisionsMaterialized;
      const [{ n }] = await DrizzlePg.select({ n: count() })
        .from(materialized)
        .where(eq(materialized.orgId, orgId));
      return n;
    };

    // Seed 3 decisions. `dim_mrt_decisions` is a view that produces one row
    // per (decision × non-CUSTOM_ACTION decision_component); we use a single
    // NO_ACTION component per decision so the row count maps 1:1.
    await insertDecisions(DrizzlePg, orgId, reviewerId, 3);

    // Baseline: nothing materialized yet for this org.
    expect(await countMaterializedForOrg()).toBe(0);

    // First run: should copy all 3 seeded decisions across.
    await RefreshMRTDecisionsMaterializedViewJob.run();
    expect(await countMaterializedForOrg()).toBe(3);

    // Second run with no new decisions: should be a no-op. The job's
    // `oneMinutePrevious` cutoff means it re-reads recent rows on every run,
    // so the `ON CONFLICT DO NOTHING` carries the load.
    await RefreshMRTDecisionsMaterializedViewJob.run();
    expect(await countMaterializedForOrg()).toBe(3);

    // Add 2 more decisions, run again: should pick up exactly the new ones.
    await insertDecisions(DrizzlePg, orgId, reviewerId, 2);
    await RefreshMRTDecisionsMaterializedViewJob.run();
    expect(await countMaterializedForOrg()).toBe(5);
  }, 60_000);
});

describe('Detect rule pass rate anomalies job (integration)', () => {
  const orgId = uid();
  let harness: IntegrationServer | undefined;
  let orgCleanup: (() => Promise<unknown>) | undefined;
  let coopUserCleanup: (() => Promise<unknown>) | undefined;
  let coopUserId: string;
  let ruleId: string;

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        DrizzlePg: harness.deps.DrizzlePg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;

    // Rule creator — gets the in-app notification when alarm state changes.
    const userFixture = await createUser(harness.deps.DrizzlePg, orgId);
    coopUserId = userFixture.user.id;
    coopUserCleanup = userFixture.cleanup;

    // Seed a rule in the OK alarm state; the job only needs it to exist in
    // `public.rules` to match the rule_id it pulls from ClickHouse.
    ruleId = uid();
    const now = new Date();
    await harness.deps.DrizzlePg.insert(schema.rules).values({
      id: ruleId,
      orgId,
      creatorId: coopUserId,
      name: `anomaly-test-rule-${uid()}`,
      description: null,
      conditionSet: { conditions: [], conjunction: 'AND' },
      ruleType: RuleType.CONTENT,
      statusIfUnexpired: RuleStatus.LIVE,
      tags: [],
      dailyActionsRun: 0,
      alarmStatus: RuleAlarmStatus.OK,
      alarmStatusSetAt: new Date(0),
      maxDailyActions: null,
      expirationTime: null,
      parentId: null,
      createdAt: now,
      updatedAt: now,
    });
  }, 60_000);

  afterAll(async () => {
    const runStep = async (fn?: () => Promise<unknown>) => {
      if (!fn) return;
      try {
        await fn();
      } catch (err) {
        console.warn('[background-jobs.integ] cleanup step failed', err);
      }
    };
    try {
      if (harness) {
        await runStep(async () => {
          await harness!.deps.DrizzlePg.delete(schema.notifications).where(
            eq(schema.notifications.userId, coopUserId),
          );
        });
        await runStep(async () => {
          await harness!.deps.DrizzlePg.delete(schema.rules).where(
            eq(schema.rules.id, ruleId),
          );
        });
        // ClickHouse seeded rows are partitioned by date; cleaning them up
        // would require a heavyweight ALTER. Each test run uses a fresh
        // `ruleId`, so leftover rows don't collide.
      }
      await runStep(coopUserCleanup);
      await runStep(orgCleanup);
    } finally {
      await harness?.shutdown();
    }
  }, 30_000);

  test('first run fires alarm notification + updates rule; second run is a no-op', async () => {
    if (!harness) throw new Error('harness was not initialized');
    const { DrizzlePg, DataWarehouse, Tracer, DetectRulePassRateAnomaliesJob } =
      harness.deps;

    // Seed 25 historical 1-hour periods with a low distinct-passing-users
    // rate and 1 current period with a high one, sized to clear the
    // data-adequacy bar (>=24 periods, >=4000 runs, >2 prior passes) and the
    // 25%-above-historical + binomial thresholds.
    await seedAnomalyStatistics(DataWarehouse, Tracer, {
      orgId,
      ruleId,
      historicalPeriods: 25,
      historicalRunsPerPeriod: 200,
      historicalDistinctUsersPerPeriod: 0, // a few periods get 1 user each
      currentPeriodRuns: 1000,
      currentPeriodDistinctUsers: 50,
    });

    const countNotifications = async () => {
      const [{ n }] = await DrizzlePg.select({ n: count() })
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, coopUserId));
      return n;
    };

    const getRuleAlarmStatus = async () => {
      const [row] = await DrizzlePg.select({
        alarmStatus: schema.rules.alarmStatus,
      })
        .from(schema.rules)
        .where(eq(schema.rules.id, ruleId));
      return row.alarmStatus;
    };

    // First run: alarm fires.
    await DetectRulePassRateAnomaliesJob.run();
    expect(await getRuleAlarmStatus()).toBe(RuleAlarmStatus.ALARM);
    expect(await countNotifications()).toBe(1);

    // Second run with the same statistics: no double-fire. The job filters
    // to rules whose computed alarm differs from the stored one; since we
    // just stored ALARM, no notification is created and no row is updated.
    await DetectRulePassRateAnomaliesJob.run();
    expect(await getRuleAlarmStatus()).toBe(RuleAlarmStatus.ALARM);
    expect(await countNotifications()).toBe(1);
  }, 120_000);
});

/**
 * Insert N decisions for the given org. Each decision uses a single
 * NO_ACTION decision_component (no actions / no policies), so the
 * `dim_mrt_decisions` view emits exactly one row per decision via its
 * non-CUSTOM_ACTION branch.
 */
async function insertDecisions(
  db: CoopDb,
  orgId: string,
  reviewerId: string,
  count: number,
) {
  const rows = Array.from({ length: count }).map(() => {
    const decisionId = uuidv4();
    const itemId = uid();
    const itemTypeId = uid();
    return {
      id: decisionId,
      orgId,
      queueId: uid(),
      reviewerId,
      decisionComponents: [{ type: 'NO_ACTION' }],
      relatedActions: [],
      jobPayload: {
        id: uuidv4(),
        payload: {
          item: {
            itemId,
            itemTypeIdentifier: { id: itemTypeId },
          },
        },
      },
      enqueueSourceInfo: null,
      itemCreatedAt: null,
      decisionReason: null,
    };
  });
  await db.insert(schema.manualReviewDecisions).values(rows);
}

/**
 * Seed `RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS` so the
 * given rule trips the alarm path on the next anomaly-detection run.
 *
 * The historical periods are distributed back from now in 1-hour increments.
 * Passes are spread across the periods (so `priorPasses > 2`) while keeping
 * the per-period numbers small enough that the current period stands out.
 */
async function seedAnomalyStatistics(
  dataWarehouse: IntegrationServer['deps']['DataWarehouse'],
  tracer: IntegrationServer['deps']['Tracer'],
  opts: {
    orgId: string;
    ruleId: string;
    historicalPeriods: number;
    historicalRunsPerPeriod: number;
    historicalDistinctUsersPerPeriod: number;
    currentPeriodRuns: number;
    currentPeriodDistinctUsers: number;
  },
) {
  const HOUR_MS = 60 * 60 * 1000;
  const now = new Date();

  const userIdArray = (count: number, prefix: string) =>
    jsonStringify(
      Array.from({ length: count }).map((_, idx) => `${prefix}-u${idx}`),
    );

  // End the current period 30s before "now": the query filters on
  // ClickHouse's clock, which can be skewed from the Node clock used here.
  const currentEnd = new Date(now.valueOf() - 30_000);
  const currentStart = new Date(currentEnd.valueOf() - HOUR_MS);
  const currentRow = formatStatsRow({
    orgId: opts.orgId,
    ruleId: opts.ruleId,
    ruleVersion: now,
    numPasses: opts.currentPeriodDistinctUsers,
    passesDistinctUserIds: userIdArray(
      opts.currentPeriodDistinctUsers,
      'current',
    ),
    numRuns: opts.currentPeriodRuns,
    tsStart: currentStart,
    tsEnd: currentEnd,
  });

  // Spread distinct users across the early periods so the `priorPasses > 2`
  // data-adequacy check clears.
  const usersBearingPeriods = Math.max(
    opts.historicalDistinctUsersPerPeriod,
    4,
  );
  const historicalRows = Array.from({
    length: opts.historicalPeriods,
  }).map((_, idx) => {
    const i = idx + 1;
    const periodEnd = new Date(currentStart.valueOf() - i * HOUR_MS);
    const periodStart = new Date(periodEnd.valueOf() - HOUR_MS);
    const carriesUser = i <= usersBearingPeriods;
    return formatStatsRow({
      orgId: opts.orgId,
      ruleId: opts.ruleId,
      ruleVersion: now,
      numPasses: carriesUser ? 1 : 0,
      passesDistinctUserIds: carriesUser ? userIdArray(1, `hist-${i}`) : '[]',
      numRuns: opts.historicalRunsPerPeriod,
      tsStart: periodStart,
      tsEnd: periodEnd,
    });
  });

  // Use INSERT INTO ... VALUES rather than the analytics bulkWrite path so
  // the rows are immediately queryable (no batch flush latency to wait on).
  const valuesSql = [currentRow, ...historicalRows].join(', ');
  await dataWarehouse.query(
    `INSERT INTO RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
       (org_id, rule_id, rule_version, num_passes, passes_distinct_user_ids, num_runs, ts_start_inclusive, ts_end_exclusive)
     VALUES ${valuesSql}`,
    tracer,
    [],
  );
}

/**
 * ClickHouse `DateTime64(3)` literals accept `YYYY-MM-DD HH:MM:SS.sss` but
 * reject the ISO `Z` suffix.
 */
function toClickHouseDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/Z$/, '');
}

function formatStatsRow(opts: {
  orgId: string;
  ruleId: string;
  ruleVersion: Date;
  numPasses: number;
  passesDistinctUserIds: string;
  numRuns: number;
  tsStart: Date;
  tsEnd: Date;
}): string {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return (
    `(` +
    [
      q(opts.orgId),
      q(opts.ruleId),
      q(toClickHouseDateTime(opts.ruleVersion)),
      String(opts.numPasses),
      // passes_distinct_user_ids is a String column carrying a JSON array.
      q(opts.passesDistinctUserIds),
      String(opts.numRuns),
      q(toClickHouseDateTime(opts.tsStart)),
      q(toClickHouseDateTime(opts.tsEnd)),
    ].join(', ') +
    `)`
  );
}
