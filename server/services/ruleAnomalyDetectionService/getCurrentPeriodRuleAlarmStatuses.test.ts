import { RuleAlarmStatus } from '../moderationConfigService/index.js';
import makeGetCurrentPeriodRuleAlarmStatuses from './getCurrentPeriodRuleAlarmStatuses.js';

describe('getCurrentPeriodRuleAlarmStatuses', () => {
  test('returns INSUFFICIENT_DATA when rule history has no matching entry', async () => {
    const ruleId = 'rule-without-history';
    const ruleVersion = new Date('2026-08-22T00:00:00.000Z');
    const currentPeriod = {
      ruleId,
      approxRuleVersion: ruleVersion,
      windowStart: new Date('2026-08-22T00:00:00.000Z'),
      passCount: 50,
      passingUsersCount: 50,
      runsCount: 1000,
    };
    const historicalPeriods = Array.from({ length: 25 }, (_, index) => ({
      ruleId,
      approxRuleVersion: ruleVersion,
      windowStart: new Date(
        Date.parse('2026-08-22T00:00:00.000Z') - (index + 1) * 60 * 60 * 1000,
      ),
      passCount: index < 4 ? 1 : 0,
      passingUsersCount: index < 4 ? 1 : 0,
      runsCount: 200,
    }));
    const getStatuses = makeGetCurrentPeriodRuleAlarmStatuses(
      async () => [currentPeriod, ...historicalPeriods],
      async () => [],
    );

    await expect(getStatuses()).resolves.toEqual({
      [ruleId]: {
        status: RuleAlarmStatus.INSUFFICIENT_DATA,
        meta: {
          lastPeriodPassRate: undefined,
          secondToLastPeriodPassRate: undefined,
        },
      },
    });
  });
});
