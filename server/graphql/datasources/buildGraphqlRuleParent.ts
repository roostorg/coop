import { type Rule as SequelizeRule } from '../../models/rules/RuleModel.js';
import { type User } from '../../models/UserModel.js';
import {
  type PlainRuleWithLatestVersion,
  type Rule as RuleGraphqlParent,
} from '../../models/rules/ruleTypes.js';
import { type ModerationConfigService } from '../../services/moderationConfigService/index.js';

type FindUserByIdAndOrg = (opts: {
  where: { id: string; orgId: string };
}) => Promise<User | null>;

/**
 * Builds a GraphQL Rule parent (plain row fields + the three association
 * getters our resolvers actually use) backed by ModerationConfigService
 * reads and a Sequelize-backed User lookup for the creator.
 *
 * The returned object only implements the {@link RuleGraphqlParent} contract
 * (`getCreator` / `getActions` / `getPolicies`). We cast to `SequelizeRule`
 * at the return to satisfy the GraphQL codegen parent type that still points
 * at `RuleModel.Rule`; resolvers that reach for Sequelize-only methods like
 * `save` / `destroy` / `getContentTypes` / `getBacktests` on this value will
 * blow up at runtime. The cast will be removed once `codegen.yaml` is flipped
 * to `ruleTypes.js#Rule` (see the TODO there).
 */
export function buildGraphqlRuleParent(
  plain: PlainRuleWithLatestVersion,
  deps: {
    moderationConfigService: ModerationConfigService;
    findUserByIdAndOrg: FindUserByIdAndOrg;
  },
): SequelizeRule {
  const parent: RuleGraphqlParent = {
    ...plain,
    async getCreator() {
      const user = await deps.findUserByIdAndOrg({
        where: { id: plain.creatorId, orgId: plain.orgId },
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
  return parent as unknown as SequelizeRule;
}
