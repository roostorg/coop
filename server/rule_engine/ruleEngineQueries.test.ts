import { uid } from 'uid';

import createOrg from '../test/fixtureHelpers/createOrg.js';
import createRule from '../test/fixtureHelpers/createRule.js';
import { makeTransactionalTestWithFixture } from '../test/harness/transactionalTest.js';
import { getUtcDateOnlyString } from '../utils/time.js';

describe('recordRuleActionLimitUsage', () => {
  const testWithRules = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { org } = await createOrg(deps, uid());
    const [ruleA, ruleB] = await Promise.all([
      createRule(deps.PrismaPg, org.id),
      createRule(deps.PrismaPg, org.id),
    ]);
    const readUsage = async (id: string) =>
      deps.PrismaPg.rules.findUniqueOrThrow({
        select: { daily_actions_run: true, last_action_date: true },
        where: { id },
      });
    return { deps, ruleA, ruleB, readUsage };
  });

  testWithRules(
    'starts the count for today, then increments it',
    async ({ deps, ruleA, ruleB, readUsage }) => {
      const today = new Date(String(getUtcDateOnlyString()));

      await deps.recordRuleActionLimitUsage([ruleA.id]);
      expect(await readUsage(ruleA.id)).toEqual({
        daily_actions_run: 1,
        last_action_date: today,
      });

      await deps.recordRuleActionLimitUsage([ruleA.id, ruleB.id]);
      expect(await readUsage(ruleA.id)).toEqual({
        daily_actions_run: 2,
        last_action_date: today,
      });
      expect(await readUsage(ruleB.id)).toEqual({
        daily_actions_run: 1,
        last_action_date: today,
      });
    },
  );

  testWithRules(
    'resets a count left over from an earlier day',
    async ({ deps, ruleA, readUsage }) => {
      await deps.PrismaPg.rules.update({
        data: {
          daily_actions_run: 7,
          last_action_date: new Date('2020-01-01'),
        },
        where: { id: ruleA.id },
      });

      await deps.recordRuleActionLimitUsage([ruleA.id]);
      expect(await readUsage(ruleA.id)).toEqual({
        daily_actions_run: 1,
        last_action_date: new Date(String(getUtcDateOnlyString())),
      });
    },
  );
});
