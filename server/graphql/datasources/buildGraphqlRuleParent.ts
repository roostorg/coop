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
  // getActions and getActionParameters resolve from the same joined read, so
  // share one lazy promise to avoid querying the rule's actions twice.
  let actionsWithParameters:
    | ReturnType<ModerationConfigService['getActionsForRuleId']>
    | undefined;
  const getActionsWithParameters = async () => {
    actionsWithParameters ??= deps.moderationConfigService.getActionsForRuleId({
      orgId: plain.orgId,
      ruleId: plain.id,
    });
    return actionsWithParameters;
  };

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
      return (await getActionsWithParameters()).map((it) => it.action);
    },
    async getActionParameters() {
      const withParams = await getActionsWithParameters();
      return withParams.map((it) => ({
        actionId: it.action.id,
        parameters: it.parameters,
      }));
    },
    async getPolicies() {
      const byRule = await deps.moderationConfigService.getPoliciesByRuleIds([
        plain.id,
      ]);
      return byRule[plain.id] ?? [];
    },
  };
}
