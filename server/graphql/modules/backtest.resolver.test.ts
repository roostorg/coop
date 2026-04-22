import { UserRole } from '../../models/types/permissioning.js';
import { resolvers } from './backtest.js';

describe('backtest resolvers', () => {
  describe('Mutation.createBacktest', () => {
    it('does not call getRuleByIdAndOrg when the user lacks RUN_BACKTEST', async () => {
      const getRuleByIdAndOrg = jest.fn();
      const createBacktest = jest.fn();

      const ctx = {
        getUser: () => ({
          id: 'user-1',
          orgId: 'org-1',
          role: UserRole.MODERATOR,
        }),
        services: {
          ModerationConfigService: { getRuleByIdAndOrg },
        },
        dataSources: {
          ruleAPI: { createBacktest },
        },
      };

      await expect(
        (resolvers.Mutation as { createBacktest: (...a: unknown[]) => Promise<unknown> })
          .createBacktest(
            {},
            {
              input: {
                ruleId: 'rule-1',
                sampleDesiredSize: 10,
                sampleStartAt: new Date().toISOString(),
                sampleEndAt: new Date().toISOString(),
              },
            },
            ctx as never,
          ),
      ).rejects.toThrow('User not authorized to create backtests.');

      expect(getRuleByIdAndOrg).not.toHaveBeenCalled();
      expect(createBacktest).not.toHaveBeenCalled();
    });
  });
});
