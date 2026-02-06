import lodash from 'lodash';

import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import { WEEK_MS } from '../../utils/time.js';
import { type RuleAlarmStatus } from '../moderationConfigService/index.js';
import getRuleAlarmStatus from './getRuleAlarmStatus.js';

const { mapValues, groupBy } = lodash;

const makeGetCurrentPeriodRuleAlarmStatuses = inject(
  ['getRuleAnomalyDetectionStatistics', 'getSimplifiedRuleHistory'],
  (getRuleStats, getRuleHistory) =>
    async function () {
      const now = new Date();
      const oneWeekAgo = new Date(now.valueOf() - WEEK_MS);

      const passStats = await getRuleStats({ startTime: oneWeekAgo });
      const statsByRule = groupBy(passStats, (it) => it.ruleId);

      const minVersionsByRule = await getMinimumAnomalyDetectionRuleVersions(
        getRuleHistory,
        undefined,
        oneWeekAgo,
      );

      return mapValues(statsByRule, (passStats) => {
        const { ruleId } = passStats[0];

        // getRuleAlarmStatus assumes that each rule has an underlying pass rate
        // (i.e., percentage of executions for which the rule matches), and
        // determines whether a rule is in alarm by looking for improbable
        // deviations from that pass rate. However, this didn't work well for
        // Some platforms. The basic issue is that there's actually a feedback loop
        // involved that causes a single period's pass rate to sometimes deviate
        // very dramatically from the long-run pass rate, without us being in a
        // state of alarm. Specifically, what happens is: on some platforms, a user is
        // notified right away when one of their pieces of content is deleted by
        // a rule; this very often leads them to try to post the same piece of
        // content again, which is usually also gets caught by the rule; this
        // duplicate posting then triggers a spike in the pass rate, well above
        // what's explicable by the random variation in pass rate we'd expect.
        // This repeat posting phenomenon doesn't seem like it should be a big
        // deal. However, because some platform rules pass so infrequently -- some
        // rules' long-run pass rates are under 1 in 10,000, even counting any
        // repeat posts -- it turned out that repeat posting by users who hit a
        // rule was triggering the majority of our alarms, and often accounted
        // for 50% or more of a rule's passes in a given period. To work around
        // this issue, but still maintain the same basic anomaly detection
        // model, we represent the number of passes _not_ as the number of times
        // that the rule passed in a period, but rather as the number of
        // distinct users that caused the rule to pass in that period.
        const applicableStats = passStats
          .filter((it) => it.approxRuleVersion >= minVersionsByRule[ruleId])
          .map((it) => ({ passes: it.passingUsersCount, runs: it.runsCount }));

        return {
          status: getRuleAlarmStatus(applicableStats),
          meta: {
            lastPeriodPassRate: !applicableStats.length
              ? undefined
              : applicableStats[0].runs === 0
              ? 0
              : applicableStats[0].passes / applicableStats[0].runs,
            secondToLastPeriodPassRate:
              applicableStats.length < 2
                ? undefined
                : applicableStats[1].runs === 0
                ? 0
                : applicableStats[1].passes / applicableStats[1].runs,
          },
        };
      });
    },
);

export default makeGetCurrentPeriodRuleAlarmStatuses;
export type GetCurrentPeriodRuleAlarmStatuses = () => Promise<{
  [ruleId: string]: {
    status: RuleAlarmStatus;
    meta: {
      lastPeriodPassRate: number | undefined;
      secondToLastPeriodPassRate: number | undefined;
    };
  };
}>;

/**
 * For each of the passed in rule ids, returns the minimum (i.e., oldest)
 * version of the rule that's still identical to the current version of the rule
 * _for anomaly detection purposes_ (i.e., whose historical pass rate data is
 * still applicable). This leverages the fact that some changes that create a
 * new rule version, like changing a rule's associated actions (or name, etc),
 * don't actually influence the rule's pass rate.
 */
async function getMinimumAnomalyDetectionRuleVersions(
  getRuleHistory: Dependencies['getSimplifiedRuleHistory'],
  ruleIds?: string[],
  startTime?: Date,
) {
  // Returns the versions of all rules from the past week, where each 'version'
  // indicates a change that's _actually salient to anomaly detection_ (i.e.,
  // that effects the rule's pass rate).
  const ruleVersionHistoriesByRule = groupBy(
    await getRuleHistory(['conditionSet', 'itemTypeIds'], ruleIds, startTime),
    (it) => it.id,
  );

  // Find the version representing the date when this rule's
  // anomaly-detection-relevant fields were most-recently changed.
  return mapValues(
    ruleVersionHistoriesByRule,
    (versions) => versions[versions.length - 1].approxVersion,
  );
}
