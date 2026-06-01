import {
  type ModerationConfigService,
  type PlainRuleWithLatestVersion,
} from '../../services/moderationConfigService/index.js';
import { type GraphQLRuleParent } from './ruleKyselyPersistence.js';
import { type GraphQLUserParent } from './userKyselyPersistence.js';

type FindUserByIdAndOrg = (opts: {
  id: string;
  orgId: string;
}) => Promise<GraphQLUserParent | undefined>;

/**
 * Builds a GraphQL Rule parent (plain row fields + the three association
 * getters our Rule / ContentRule / UserRule / RuleInsights resolvers actually
 * use) backed by ModerationConfigService reads and a Kysely-backed User
 * lookup for the creator.
 */
export function buildGraphqlRuleParent(
  plain: PlainRuleWithLatestVersion,
  deps: {
    moderationConfigService: ModerationConfigService;
    findUserByIdAndOrg: FindUserByIdAndOrg;
  },
): GraphQLRuleParent {
  return {
    ...plain,
    async getCreator() {
      const user = await deps.findUserByIdAndOrg({
        id: plain.creatorId,
        orgId: plain.orgId,
      });
      if (user == null) {
        throw new Error(`User not found for rule creator ${plain.creatorId}`);
      }
      return user;
    },
    async getActions() {
      return deps.moderationConfigService.getActionsForRuleId({
        orgId: plain.orgId,
        ruleId: plain.id,
      });
    },
    async getPolicies() {
      const byRule = await deps.moderationConfigService.getPoliciesByRuleIds([
        plain.id,
      ]);
      return byRule[plain.id] ?? [];
    },
  };
}
