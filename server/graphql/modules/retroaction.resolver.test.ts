import { UserRole } from '../../models/types/permissioning.js';
import { resolvers } from './retroaction.js';

describe('retroaction resolvers', () => {
  describe('Mutation.runRetroaction', () => {
    it('does not call getRuleByIdAndOrg when the user lacks RUN_RETROACTION', async () => {
      const getRuleByIdAndOrg = jest.fn();
      const runRetroaction = jest.fn();

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
          ruleAPI: { runRetroaction },
        },
      };

      await expect(
        (resolvers.Mutation as { runRetroaction: (...a: unknown[]) => Promise<unknown> })
          .runRetroaction(
            {},
            {
              input: {
                ruleId: 'rule-1',
                startAt: new Date(),
                endAt: new Date(),
              },
            },
            ctx as never,
          ),
      ).rejects.toThrow('User not authorized to run retroaction.');

      expect(getRuleByIdAndOrg).not.toHaveBeenCalled();
      expect(runRetroaction).not.toHaveBeenCalled();
    });
  });
});
