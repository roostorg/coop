import { AuthenticationError } from 'apollo-server-express';

import {
  hasPermission,
  UserPermission,
} from '../../models/types/permissioning.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import {
  isNonEmptyArray,
  isNonEmptyString,
  type NonEmptyArray,
  type NonEmptyString,
} from '../../utils/typescript-types.js';
import { transformConditionForDB } from '../datasources/RuleApi.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
  type GQLRoutingRuleResolvers,
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type RoutingRule {
    id: ID!
    name: String!
    creatorId: String!
    description: String
    itemTypes: [ItemType!]!
    status: RoutingRuleStatus!
    conditionSet: ConditionSet!
    destinationQueue: ManualReviewQueue!
  }

  enum RoutingRuleStatus {
    LIVE
  }

  input CreateRoutingRuleInput {
    name: String!
    description: String
    status: RoutingRuleStatus!
    itemTypeIds: [ID!]!
    conditionSet: ConditionSetInput!
    destinationQueueId: ID!
    sequenceNumber: Int
    isAppealsRule: Boolean
  }

  input UpdateRoutingRuleInput {
    id: ID!
    name: String
    description: String
    status: RoutingRuleStatus
    itemTypeIds: [ID!]
    conditionSet: ConditionSetInput
    destinationQueueId: ID
    sequenceNumber: Int
    isAppealsRule: Boolean
  }

  input ReorderRoutingRulesInput {
    order: [ID!]!
    isAppealsRule: Boolean
  }

  input DeleteRoutingRuleInput {
    id: ID!
    isAppealsRule: Boolean
  }

  type RoutingRuleNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type QueueDoesNotExistError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type MutateRoutingRuleSuccessResponse {
    data: RoutingRule!
  }

  type MutateRoutingRulesOrderSuccessResponse {
    data: [RoutingRule!]!
  }

  union CreateRoutingRuleResponse =
      MutateRoutingRuleSuccessResponse
    | RoutingRuleNameExistsError
    | QueueDoesNotExistError

  union UpdateRoutingRuleResponse =
      MutateRoutingRuleSuccessResponse
    | RoutingRuleNameExistsError
    | NotFoundError
    | QueueDoesNotExistError

  union ReorderRoutingRulesResponse = MutateRoutingRulesOrderSuccessResponse

  type Mutation {
    createRoutingRule(
      input: CreateRoutingRuleInput!
    ): CreateRoutingRuleResponse!
    updateRoutingRule(
      input: UpdateRoutingRuleInput!
    ): UpdateRoutingRuleResponse!
    deleteRoutingRule(input: DeleteRoutingRuleInput!): Boolean!
    reorderRoutingRules(
      input: ReorderRoutingRulesInput!
    ): ReorderRoutingRulesResponse!
  }
`;

const RoutingRule: GQLRoutingRuleResolvers = {
  async destinationQueue(routingRule, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== routingRule.orgId) {
      throw new AuthenticationError('User required');
    }

    const userCanEditMRTQueues = hasPermission(
      UserPermission.EDIT_MRT_QUEUES,
      user.role,
    );

    const queueSelector = {
      orgId: user.orgId,
      queueId: routingRule.destinationQueueId,
    };

    const queue = userCanEditMRTQueues
      ? await context.services.ManualReviewToolService.getQueueForOrgAndDangerouslyBypassPermissioning(
          queueSelector,
        )
      : await context.services.ManualReviewToolService.getQueueForOrg({
          userId: user.id,
          ...queueSelector,
        });

    // Assume the queue won't be missing, as the db requires routing rules to
    // point to existing queues -- although technically the queue could've been
    // deleted between loading the rule and querying for the queue.
    return queue!;
  },
  async itemTypes(routingRule, _, context) {
    const user = context.getUser();
    if (!user || user.orgId !== routingRule.orgId) {
      throw new AuthenticationError('User required');
    }

    const itemTypes =
      await context.services.ModerationConfigService.getItemTypes({
        orgId: user.orgId,
      });

    return itemTypes.filter((itemType) =>
      routingRule.itemTypeIds.includes(itemType.id),
    );
  },
};

const Query: GQLQueryResolvers = {};

const Mutation: GQLMutationResolvers = {
  async createRoutingRule(_, params, context) {
    const user = context.getUser();
    const { itemTypeIds } = params.input;

    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    if (!itemTypeIdsAreValid(itemTypeIds)) {
      throw new Error('itemTypeIds must be a non-empty array');
    }

    try {
      const routingRule =
        await context.services.ManualReviewToolService.createRoutingRule({
          ...params.input,
          itemTypeIds,
          orgId: user.orgId,
          creatorId: user.id,
          conditionSet: transformConditionForDB(params.input.conditionSet),
          isAppealsRule: params.input.isAppealsRule ?? false,
        });

      return gqlSuccessResult(
        { data: routingRule },
        'MutateRoutingRuleSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'RoutingRuleNameExistsError',
          'QueueDoesNotExistError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async updateRoutingRule(_, params, context) {
    const user = context.getUser();
    const { itemTypeIds } = params.input;
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    if (itemTypeIds && !itemTypeIdsAreValid(itemTypeIds)) {
      throw new Error('itemTypeIds must be a non-empty array');
    }

    try {
      const routingRule =
        await context.services.ManualReviewToolService.updateRoutingRule({
          id: params.input.id,
          orgId: user.orgId,
          name: params.input.name ?? undefined,
          description: params.input.description ?? undefined,
          status: params.input.status ?? undefined,
          itemTypeIds: itemTypeIds ?? undefined,
          destinationQueueId: params.input.destinationQueueId ?? undefined,
          conditionSet: params.input.conditionSet
            ? transformConditionForDB(params.input.conditionSet)
            : undefined,
          sequenceNumber: params.input.sequenceNumber ?? undefined,
          isAppealsRule: params.input.isAppealsRule ?? false,
        });

      return gqlSuccessResult(
        { data: routingRule },
        'MutateRoutingRuleSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'RoutingRuleNameExistsError',
          'NotFoundError',
          'QueueDoesNotExistError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async deleteRoutingRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    return context.services.ManualReviewToolService.deleteRoutingRule({
      id: params.input.id,
      isAppealsRule: params.input.isAppealsRule ?? false,
    });
  },
  async reorderRoutingRules(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { order } = params.input;
    const reorderedRules =
      await context.services.ManualReviewToolService.reorderRoutingRules({
        orgId: user.orgId,
        order,
        isAppealsRule: params.input.isAppealsRule ?? false,
      });

    return gqlSuccessResult(
      { data: reorderedRules },
      'MutateRoutingRulesOrderSuccessResponse',
    );
  },
};

const resolvers = {
  RoutingRule,
  Query,
  Mutation,
};

export { typeDefs, resolvers };

function itemTypeIdsAreValid(
  arr: readonly string[],
): arr is NonEmptyArray<NonEmptyString> {
  return isNonEmptyArray(arr) && arr.every(isNonEmptyString);
}
