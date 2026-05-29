import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { unzip2 } from '../../utils/fp-helpers.js';

const makeGetRuleAnomalyDetectionaStatistics =
  (
    dataWarehouse: Dependencies['DataWarehouse'],
    tracer: Dependencies['Tracer'],
  ) =>
  /**
   * For each one hour period (starting from the given startTime, or going back
   * indefinitely if no startTime is given), and for each rule given in ruleIds
   * (or for all rules, if ruleIds is not given), it returns the number of times
   * that the rule ran, the number of executions for which it passed, and the
   * number _of distinct users_ for which it passed.
   *
   * This might be extended in the future to allow the caller to customize the
   * window of time over which each pass rate is calculated, but, for now, it's
   * always a one-hour window.
   *
   * NB: Does not return pass rates for time windows that are still in progress
   * by default.
   */
  async (
    opts: {
      ruleIds?: string[];
      startTime?: Date;
      includePeriodsInProgress?: boolean;
    } = {},
  ) => {
    const { ruleIds, startTime, includePeriodsInProgress = false } = opts;

    if (ruleIds && !ruleIds.length) {
      throw new Error('Must provide at least one ruleId to filter by ruleIds.');
    }

    // For rule_id filtering, it'd be amazing if we could just do `rule_id in ?`,
    // and then pass an array as the bind value, but the warehouse client
    // doesn't support arrays as bind values. so, we use an array below for
    // conditions that need (or are forced) to have multiple bind values, and
    // then flatten below.
    //
    // NB: we use now64(3), not now(), because the former returns DateTime64(3)
    // in UTC, matching the column type and giving timezone-stable behaviour
    // independent of the ClickHouse server's local timezone.
    const [conditions, conditionBindValues] = unzip2<string, string[] | Date>([
      ...(!includePeriodsInProgress
        ? [['ts_end_exclusive <= now64(3)', [] as string[]] as const]
        : []),
      // Wrap the bind in parseDateTime64BestEffort so the warehouse adapter's
      // Date → ISO-8601 (with `Z` suffix) bind format is parsed against the
      // DateTime64(3) column. Without it, ClickHouse rejects the implicit
      // String → DateTime64 conversion ("Cannot convert string … to type
      // DateTime64(3)").
      ...(startTime
        ? [
            [
              'ts_start_inclusive >= parseDateTime64BestEffort(?)',
              startTime,
            ] as const,
          ]
        : []),
      ...(ruleIds
        ? [
            [
              `rule_id IN (${ruleIds.map((_) => '?').join(',')})`,
              ruleIds,
            ] as const,
          ]
        : []),
    ]);

    const bindValues = conditionBindValues.flat();
    const conditionString = conditions.join(' AND ');

    // Use group by to sum passes + runs across all rule environments.
    // `JSONLength` is the ClickHouse equivalent of the Snowflake `array_size`
    // this query was originally written against — `passes_distinct_user_ids`
    // is stored as a JSON-serialised array String, not a native Array, so we
    // can't just `length(arr)` it.
    const results = await dataWarehouse.query(
      `
      SELECT
        rule_id,
        rule_version,
        num_passes,
        num_runs,
        JSONLength(passes_distinct_user_ids) as num_distinct_users,
        ts_start_inclusive
      FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
      ${conditionString.length ? `WHERE ${conditionString}` : ''}
      ORDER BY ts_start_inclusive DESC;`,
      tracer,
      bindValues,
    );

    return results.map((result) => {
      const row = result as Record<string, unknown>;
      // ClickHouse returns column names in the case they were written in the
      // SELECT (lowercase here). The Snowflake-era code expected UPPERCASE
      // identifiers — without the lowercased access, every field reads back
      // as `undefined` and the rule-id-keyed grouping in
      // `getCurrentPeriodRuleAlarmStatuses` collapses to a single
      // `"undefined"` bucket, masking every rule's true alarm state.
      return {
        ruleId: row.rule_id as string,
        // name is a reminder that JS may trim the precision on the Date here,
        // but that should be ok for our purposes.
        approxRuleVersion: new Date(row.rule_version as string | number | Date),
        // nb: the warehouse returned value for a timestamp is a JS Date, but with
        // some extra methods attached to it. These methods include toString, so
        // we cast back to a proper Date to avoid the string representation
        // changing (e.g., when serializing to JSON).
        windowStart: new Date(row.ts_start_inclusive as string | number | Date),
        // ClickHouse `Int64`/`UInt64` columns (`num_passes`, `num_runs`,
        // `JSONLength(…)`) come back as JS `BigInt`. The Snowflake-era
        // downstream code (binomialTest, arithmetic, comparisons against
        // adequacy thresholds) all assume plain `number`, so coerce here.
        passCount: Number(row.num_passes),
        passingUsersCount: Number(row.num_distinct_users),
        runsCount: Number(row.num_runs),
      };
    });
  };

export default inject(
  ['DataWarehouse', 'Tracer'],
  makeGetRuleAnomalyDetectionaStatistics,
);
export type GetRuleAnomalyDetectionStatistics = ReturnType<
  typeof makeGetRuleAnomalyDetectionaStatistics
>;
