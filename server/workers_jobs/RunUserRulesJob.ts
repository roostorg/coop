import _ from 'lodash';

import { inject } from '../iocContainer/utils.js';
import { RuleEnvironment } from '../rule_engine/RuleEngine.js';
import { toCorrelationId } from '../utils/correlationIds.js';

const { groupBy } = _;

export default inject(
  [
    'RuleEngine',
    'UserStatisticsService',
    'closeSharedResourcesForShutdown',
    'RuleModel',
  ],
  (RuleEngine, userStatisticsService, sharedResourceShutdown, Rule) => ({
    type: 'Job' as const,
    async run() {
      // TODO: we may have to do only some orgs per job run at some point.
      // For now, though, this is fine.
      const userRules = await Rule.findEnabledUserRules();

      if (!userRules.length) {
        return;
      }

      const userRulesByOrgId = groupBy(userRules, (it) => it.orgId);
      const nowString = new Date().toISOString();

      await userStatisticsService.handleUsersWithChangedScores(
        'user-rules-runner',
        async (rescoredUsers: readonly { userId: string; userTypeId: string; orgId: string }[]) => {
          await Promise.all(
            rescoredUsers.map(async ({ userId, userTypeId, orgId }: { userId: string; userTypeId: string; orgId: string }) => {
              const rulesForUser = userRulesByOrgId[orgId];

              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (!rulesForUser?.length) {
                return;
              }

              await RuleEngine.runRuleSet(
                rulesForUser,
                RuleEngine.makeRuleExecutionContext({
                  orgId,
                  input: {
                    itemId: userId,
                    itemType: {
                      id: userTypeId,
                      kind: 'USER',
                    },
                  },
                }),
                RuleEnvironment.LIVE,
                toCorrelationId({ type: 'user-rule-run', id: nowString }),
              );
            }),
          );
        },
      );
    },
    async shutdown() {
      await sharedResourceShutdown();
    },
  }),
);
