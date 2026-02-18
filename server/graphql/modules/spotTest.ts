import { AuthenticationError } from 'apollo-server-core';
import { uid } from 'uid';

import { RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { rawItemSubmissionToItemSubmission } from '../../services/itemProcessingService/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import type { GQLQueryResolvers } from '../generated.js';

const typeDefs = /* GraphQL */ `
  extend type Query {
    spotTestRule(ruleId: ID!, item: SpotTestItemInput!): RuleExecutionResult!
  }

  input SpotTestItemInput {
    itemTypeIdentifier: ItemTypeIdentifierInput!
    data: JSONObject!
  }
`;

const Query: GQLQueryResolvers = {
  async spotTestRule(_, { ruleId, item }, { services, dataSources, getUser }) {
    const user = getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const [itemTypes, rule] = await Promise.all([
      services.ModerationConfigService.getItemTypes({
        orgId: user.orgId,
        directives: { maxAge: 10 },
      }),
      dataSources.ruleAPI.getGraphQLRuleFromId(ruleId, user.orgId),
    ]);
    const itemType = itemTypes.find(
      (it) => it.id === item.itemTypeIdentifier.id,
    );
    if (!itemType) {
      throw new Error('Could not find item type');
    }

    const toItemSubmission = rawItemSubmissionToItemSubmission.bind(
      null,
      itemTypes,
      user.orgId,
      services.getItemTypeEventuallyConsistent,
    );
    const itemSubmissionOrErrors = await toItemSubmission({
      id: uid(),
      data: item.data,
      type: {
        id: item.itemTypeIdentifier.id,
        version: item.itemTypeIdentifier.version,
        // We don't support RELATED_ITEM or DateTime right now,
        // which can sometimes be required.
        schemaVariant: 'partial',
      },
    });
    if (itemSubmissionOrErrors.error) {
      throw itemSubmissionOrErrors.error;
    }
    const executionContext = services.RuleEvaluator.makeRuleExecutionContext({
      orgId: user.orgId,
      input: itemSubmissionOrErrors.itemSubmission,
    });
    const result = await services.RuleEvaluator.runRule(
      rule.conditionSet,
      executionContext,
    );
    return {
      date: '2024-01-01',
      ts: new Date('2024-01-01'),
      contentId: uid(),
      itemTypeName: itemType.name,
      itemTypeId: itemType.id,
      userId: undefined,
      userTypeId: undefined,
      content: jsonStringify(item.data),
      result: result.conditionResults,
      environment: RuleEnvironment.BACKTEST,
      passed: result.passed,
      ruleId: rule.id,
      ruleName: rule.name,
      policies: await rule.getPolicies(),
      tags: rule.tags,
    };
  },
};

const resolvers = {
  Query,
};

export { typeDefs, resolvers };
