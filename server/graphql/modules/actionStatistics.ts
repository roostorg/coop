/* eslint-disable max-lines */

import { AuthenticationError } from 'apollo-server-core';

import { type GQLQueryResolvers } from '../generated.js';

const typeDefs = /* GraphQL */ `
  type ActionData {
    count: Int!
    time: String!
    item_type_id: String
    action_id: String
    source: String
    policy_id: String
    rule_id: String
  }

  enum ActionSource {
    AUTOMATED_RULE
    MRT_DECISION
    MANUAL_ACTION_RUN
    POST_ACTIONS
  }

  enum ActionStatisticsGroupByColumns {
    RULE_ID
    ACTION_ID
    ITEM_TYPE_ID
    ACTION_SOURCE
    POLICY_ID
  }

  input ActionStatisticsFilters {
    actionIds: [String!]!
    policyIds: [String!]!
    ruleIds: [String!]!
    itemTypeIds: [String!]!
    sources: [ActionSource!]!
    startDate: DateTime!
    endDate: DateTime!
  }

  input ActionStatisticsInput {
    groupBy: ActionStatisticsGroupByColumns!
    filterBy: ActionStatisticsFilters!
    timeDivision: MetricsTimeDivisionOptions!
    timeZone: String!
  }

  type RecentUserStrikeActions {
    time: DateTime!
    itemTypeId: String!
    itemId: String!
    actionId: String!
    source: String!
  }

  input StartAndEndDateFilterByInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  input RecentUserStrikeActionsInput {
    filterBy: StartAndEndDateFilterByInput
    limit: Int!
  }

  type PolicyViolationsCount {
    count: Int!
    policyId: String!
  }

  input TopPolicyViolationsInput {
    filterBy: StartAndEndDateFilterByInput!
    timeZone: String!
  }

  type Query {
    actionStatistics(input: ActionStatisticsInput!): [ActionData!]!
    topPolicyViolations(
      input: TopPolicyViolationsInput!
    ): [PolicyViolationsCount!]!
    recentUserStrikeActions(
      input: RecentUserStrikeActionsInput!
    ): [RecentUserStrikeActions!]!
  }
`;

const Query: GQLQueryResolvers = {
  async actionStatistics(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const a = {
      MANUAL_ACTION_RUN: 'manual-action-run',
      MRT_DECISION: 'mrt-decision',
      AUTOMATED_RULE: 'automated-rule',
      POST_ACTIONS: 'post-actions',
    } as const;
    const sources = input.filterBy.sources.map((it) => a[it]);

    return context.dataSources.ruleAPI.getActionStatistics({
      ...input,
      filterBy: {
        ...input.filterBy,
        sources,
        startDate: new Date(input.filterBy.startDate),
        endDate: new Date(input.filterBy.endDate),
      },
      orgId: user.orgId,
    });
  },

  async topPolicyViolations(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const policyViolations =
      await context.dataSources.ruleAPI.getPoliciesSortedByViolationCount({
        filterBy: {
          startDate: new Date(input.filterBy.startDate),
          endDate: new Date(input.filterBy.endDate),
        },
        timeZone: input.timeZone,
        orgId: user.orgId,
      });
    return policyViolations.map((it) => ({
      count: it.count,
      policyId: it.policy_id,
    }));
  },

  async recentUserStrikeActions(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    const recentUserStrikeActions =
      await context.services.UserStrikeService.getRecentUserStrikeActions({
        orgId: user.orgId,
        filterBy: {
          startDate: input.filterBy?.startDate
            ? new Date(input.filterBy.startDate)
            : undefined,
          endDate: input.filterBy?.endDate
            ? new Date(input.filterBy.endDate)
            : undefined,
        },
        limit: input.limit,
      });
    return recentUserStrikeActions;
  },
};

const resolvers = {
  Query,
};

export { resolvers, typeDefs };
