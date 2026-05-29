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
 * Run with: npm run test:integ
 * Requires: `npm run up && npm run db:update`
 */
import { type Kysely } from 'kysely';
import { uid } from 'uid';
import { v4 as uuidv4 } from 'uuid';

import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { type ManualReviewToolServicePg } from '../../services/manualReviewToolService/index.js';
import {
  RuleAlarmStatus,
  RuleStatus,
  RuleType,
} from '../../services/moderationConfigService/index.js';
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

  beforeAll(async () => {
    harness = await makeIntegrationServer();

    const orgFixture = await createOrg(
      {
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;

    // Reviewer for the seeded decisions; the materialized view carries the
    // reviewer_id through unchanged so any valid coop user works.
    const userFixture = await createUser(harness.deps.KyselyPg, orgId);
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
          await harness!.deps.KyselyPg.deleteFrom(
            'manual_review_tool.manual_review_decisions',
          )
            .where('org_id', '=', orgId)
            .execute();
        });
        await runStep(async () => {
          await harness!.deps.KyselyPg.deleteFrom(
            'manual_review_tool.dim_mrt_decisions_materialized',
          )
            .where('org_id', '=', orgId)
            .execute();
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
    const { KyselyPg, RefreshMRTDecisionsMaterializedViewJob } = harness.deps;

    const countMaterializedForOrg = async () => {
      const { count } = await KyselyPg.selectFrom(
        'manual_review_tool.dim_mrt_decisions_materialized',
      )
        .select((eb) => eb.fn.countAll<bigint>().as('count'))
        .where('org_id', '=', orgId)
        .executeTakeFirstOrThrow();
      return Number(count);
    };

    // Seed 3 decisions. `dim_mrt_decisions` is a view that produces one row
    // per (decision × non-CUSTOM_ACTION decision_component); we use a single
    // NO_ACTION component per decision so the row count maps 1:1.
    await insertDecisions(KyselyPg, orgId, 3);

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
    await insertDecisions(KyselyPg, orgId, 2);
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
        KyselyPg: harness.deps.KyselyPg,
        ModerationConfigService: harness.deps.ModerationConfigService,
        ApiKeyService: harness.deps.ApiKeyService,
      },
      orgId,
    );
    orgCleanup = orgFixture.cleanup;

    // Rule creator — gets the in-app notification when alarm state changes.
    const userFixture = await createUser(harness.deps.KyselyPg, orgId);
    coopUserId = userFixture.user.id;
    coopUserCleanup = userFixture.cleanup;

    // Seed a rule that starts in the OK alarm state. We don't care about its
    // condition set for the anomaly path; only that it exists in `public.rules`
    // so the job can match the rule_id it pulls from ClickHouse.
    ruleId = uid();
    const now = new Date();
    await harness.deps.KyselyPg.insertInto('public.rules')
      .values({
        id: ruleId,
        org_id: orgId,
        creator_id: coopUserId,
        name: `anomaly-test-rule-${uid()}`,
        description: null,
        condition_set: { conditions: [], conjunction: 'AND' },
        rule_type: RuleType.CONTENT,
        status_if_unexpired: RuleStatus.LIVE,
        tags: [],
        daily_actions_run: 0,
        alarm_status: RuleAlarmStatus.OK,
        alarm_status_set_at: new Date(0),
        max_daily_actions: null,
        expiration_time: null,
        parent_id: null,
        // Kysely types these as `GeneratedAlways`, but Postgres has no
        // default for them and rejects nulls. The schema must have been
        // changed after the Kysely types were generated.
        created_at: now,
        updated_at: now,
      })
      .execute();
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
          await harness!.deps.KyselyPg.deleteFrom('public.notifications')
            .where('userId', '=', coopUserId)
            .execute();
        });
        await runStep(async () => {
          await harness!.deps.KyselyPg.deleteFrom('public.rules')
            .where('id', '=', ruleId)
            .execute();
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
    const { KyselyPg, DataWarehouse, Tracer, DetectRulePassRateAnomaliesJob } =
      harness.deps;

    // Seed 25 historical 1-hour periods with a low distinct-passing-users
    // rate and 1 current period with a high distinct-passing-users rate.
    // `getRuleAlarmStatus` uses _distinct passing users_, not raw pass count,
    // as its `passes` (see the long comment in `getCurrentPeriodRuleAlarmStatuses`
    // about repeat posters). So the seed has to populate
    // `passes_distinct_user_ids` with real id arrays for the math to work.
    //
    // Picks here clear the data-adequacy bar (>=24 periods, >=4000 runs,
    // >2 prior passes) and the 25%-above-historical + binomial thresholds.
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
      const { count } = await KyselyPg.selectFrom('public.notifications')
        .select((eb) => eb.fn.countAll<bigint>().as('count'))
        .where('userId', '=', coopUserId)
        .executeTakeFirstOrThrow();
      return Number(count);
    };

    const getRuleAlarmStatus = async () => {
      const row = await KyselyPg.selectFrom('public.rules')
        .select(['alarm_status'])
        .where('id', '=', ruleId)
        .executeTakeFirstOrThrow();
      return row.alarm_status;
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
  db: Kysely<CombinedPg & ManualReviewToolServicePg>,
  orgId: string,
  count: number,
) {
  const rows = Array.from({ length: count }).map(() => {
    const decisionId = uuidv4();
    const itemId = uid();
    const itemTypeId = uid();
    return {
      id: decisionId,
      org_id: orgId,
      queue_id: uid(),
      reviewer_id: uid(),
      decision_components: [
        {
          type: 'NO_ACTION',
        },
      ] as unknown as never,
      related_actions: [] as unknown as never,
      job_payload: {
        id: uuidv4(),
        payload: {
          item: {
            itemId,
            itemTypeIdentifier: { id: itemTypeId },
          },
        },
      } as unknown as never,
      enqueue_source_info: null,
      item_created_at: null,
      decision_reason: null,
    };
  });
  await db
    .insertInto('manual_review_tool.manual_review_decisions')
    .values(rows)
    .execute();
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

  // Current period: ends just before "now" so the query's
  // `ts_end_exclusive <= now64(3)` filter accepts it.
  const currentEnd = new Date(now.valueOf() - 1000);
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

  // Spread a few distinct users across the first historical periods so the
  // `priorPasses > 2` data-adequacy check (computed off
  // `passingUsersCount` = `JSONLength(passes_distinct_user_ids)`) clears.
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
      // passes_distinct_user_ids is a String column carrying a JSON array;
      // the job's query (`JSONLength(passes_distinct_user_ids)`) treats it
      // as such.
      q(opts.passesDistinctUserIds),
      String(opts.numRuns),
      q(toClickHouseDateTime(opts.tsStart)),
      q(toClickHouseDateTime(opts.tsEnd)),
    ].join(', ') +
    `)`
  );
}
