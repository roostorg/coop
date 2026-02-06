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
    // and then pass an array as the bind value, but the snowflake client
    // doesn't support arrays as bind values. so, we use an array below for
    // conditions that need (or are forced) to have multiple bind values, and
    // then flatten below.
    //
    // NB: we use sysdate(), not current_timestamp() because the former gives a
    // UTC time, which is what we need (current_timestamp() is server-local time).
    const [conditions, conditionBindValues] = unzip2<string, string[] | Date>([
      ...(!includePeriodsInProgress
        ? [['ts_end_exclusive <= SYSDATE()', [] as any] as const]
        : []),
      ...(startTime ? [['ts_start_inclusive >= ?', startTime] as const] : []),
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
    const results = await dataWarehouse.query(
      `
      SELECT
        rule_id,
        rule_version,
        num_passes,
        num_runs,
        array_size(passes_distinct_user_ids) as num_distinct_users,
        ts_start_inclusive
      FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
      ${conditionString.length ? `WHERE ${conditionString}` : ''}
      ORDER BY ts_start_inclusive DESC;`,
      tracer,
      bindValues,
    );

    return results.map((result: any) => ({
      ruleId: result.RULE_ID,
      // name is a reminder that JS may trim the precision on the Date here,
      // but that should be ok for our purposes.
      approxRuleVersion: new Date(result.RULE_VERSION),
      // nb: the snowflake returned value for a timestamp is a JS Date, but with
      // some extra methods attached to it. These methods include toString, so
      // we cast back to a proper Date to avoid the string representation
      // changing (e.g., when serializing to JSON).
      windowStart: new Date(result.TS_START_INCLUSIVE),
      passCount: result.NUM_PASSES,
      passingUsersCount: result.NUM_DISTINCT_USERS,
      runsCount: result.NUM_RUNS,
    }));
  };

export default inject(
  ['DataWarehouse', 'Tracer'],
  makeGetRuleAnomalyDetectionaStatistics,
);
export type GetRuleAnomalyDetectionStatistics = ReturnType<
  typeof makeGetRuleAnomalyDetectionaStatistics
>;
