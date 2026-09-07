import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { unzip2 } from '../../utils/fp-helpers.js';
import { parseClickhouseTimestamp } from '../../utils/time.js';

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
    // now64 defaults to the server timezone; pass 'UTC' explicitly.
    const [conditions, conditionBindValues] = unzip2<string, string[] | Date>([
      ...(!includePeriodsInProgress
        ? [["ts_end_exclusive <= now64(3, 'UTC')", [] as string[]] as const]
        : []),
      // parseDateTime64BestEffort: ClickHouse rejects the adapter's ISO-8601
      // bind string when implicitly converting to DateTime64(3).
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
    // JSONLength: passes_distinct_user_ids is a JSON-serialised array String,
    // not a native Array.
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
      return {
        ruleId: row.rule_id as string,
        // name is a reminder that JS may trim the precision on the Date here,
        // but that should be ok for our purposes.
        approxRuleVersion: parseClickhouseTimestamp(
          row.rule_version as string | number | Date,
        ),
        // nb: the warehouse returned value for a timestamp is a JS Date, but with
        // some extra methods attached to it. These methods include toString, so
        // we cast back to a proper Date to avoid the string representation
        // changing (e.g., when serializing to JSON).
        windowStart: parseClickhouseTimestamp(
          row.ts_start_inclusive as string | number | Date,
        ),
        // Int64/UInt64 columns deserialise as BigInt; downstream math needs number.
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
