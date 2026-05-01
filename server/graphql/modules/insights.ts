// because graphql args are sometimes imported wiht _, we use
// lodash as opposed to _ to avoid overloading
import lodash from 'lodash';

import { gatherSignalsFromResult } from '../../services/analyticsQueries/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { isCoopErrorOfType, makeNotFoundError } from '../../utils/errors.js';
import type {
  GQLQueryResolvers,
  GQLReportingRuleExecutionResultResolvers,
  GQLReportingRuleInsightsResolvers,
  GQLRuleExecutionResultResolvers,
  GQLRuleInsightsResolvers,
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { unauthenticatedError } from '../utils/errors.js';

const typeDefs = /* GraphQL */ `
  enum LookbackVersion {
    LATEST
    PRIOR
  }

  type SignalWithScore {
    signalName: String!
    integration: String
    subcategory: String
    score: String!
  }

  # Not all fields are required here because, sometimes, what the backend exposes
  # to GQL to be returned as this type does not contain all the fields.
  type RuleExecutionResult {
    date: Date!
    ts: DateTime!
    contentId: String!
    itemTypeName: String!
    itemTypeId: ID!
    userId: String
    userTypeId: String
    content: String!
    result: ConditionSetWithResult
    signalResults: [SignalWithScore!]
    environment: RuleEnvironment!
    passed: Boolean!
    ruleId: ID!
    ruleName: String!
    policies: [String!]!
    tags: [String!]!
  }

  type ReportingRuleExecutionResult {
    date: Date!
    ts: DateTime!
    itemId: ID!
    itemTypeName: String!
    itemTypeId: ID!
    itemData: String!
    creatorId: String
    creatorTypeId: String
    result: ConditionSetWithResult
    signalResults: [SignalWithScore!]
    environment: RuleEnvironment!
    passed: Boolean!
    ruleId: ID!
    ruleName: String!
    policyIds: [String!]!
  }

  type RuleInsights {
    passRateData(lookbackStartDate: Date): [RulePassRateData]
    latestVersionSamples: [RuleExecutionResult!]!
    priorVersionSamples: [RuleExecutionResult!]!
  }

  type RulePassRateData {
    date: String!
    totalMatches: Float!
    totalRequests: Float!
  }

  type ReportingRuleInsights {
    passRateData(lookbackStartDate: Date): [ReportingRulePassRateData!]!
    latestVersionSamples: [ReportingRuleExecutionResult!]!
    priorVersionSamples: [ReportingRuleExecutionResult!]!
  }

  type ReportingRulePassRateData {
    date: String!
    totalMatches: Float!
    totalRequests: Float!
  }

  type UserStrikeBucket {
    numStrikes: Int!
    numUsers: Int!
  }

  input GetFullResultForItemInput {
    ruleId: ID!
    item: ItemIdentifierInput!
    date: String
    lookback: LookbackVersion
  }

  type Query {
    getUserStrikeCountDistribution: [UserStrikeBucket!]!
    getFullRuleResultForItem(
      input: GetFullResultForItemInput!
    ): GetFullResultForItemResponse!
    getFullReportingRuleResultForItem(
      input: GetFullResultForItemInput!
    ): GetFullReportingRuleResultForItemResponse!
  }

  union GetFullResultForItemResponse = RuleExecutionResult | NotFoundError
  union GetFullReportingRuleResultForItemResponse =
      ReportingRuleExecutionResult
    | NotFoundError
`;

const RuleExecutionResult: GQLRuleExecutionResultResolvers = {
  async signalResults(ruleExecutionResult, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const fullResults = ruleExecutionResult.result;
    if (!fullResults) {
      return [];
    }

    return gatherSignalsFromResult(fullResults);
  },
};

const ReportingRuleExecutionResult: GQLReportingRuleExecutionResultResolvers = {
  async signalResults(reportingRuleExecutionResult, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const fullResults = reportingRuleExecutionResult.result;
    if (!fullResults) {
      return [];
    }

    return gatherSignalsFromResult(fullResults);
  },
};

const RuleInsights: GQLRuleInsightsResolvers = {
  async passRateData(rule, args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.dataSources.ruleAPI.ruleInsights.getRulePassRateData(
      rule.id,
      rule.orgId,
      args.lookbackStartDate ? new Date(args.lookbackStartDate) : undefined,
    );
  },
  async latestVersionSamples(rule, _args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const samples =
      await context.dataSources.ruleAPI.ruleInsights.getRulePassingContentSamples(
        {
          ruleId: rule.id,
          orgId: rule.orgId,
          numSamples: 300,
          source: 'latestVersion',
        },
      );

    // TODO: type this properly. graphql queries would throw an exception if
    // asking for fields that aren't populated here. To provide them, we'll
    // have to update (and add better typings for) getRulePassingContentSamples.
    /* eslint-disable @typescript-eslint/no-explicit-any -- see TODO above */
    return samples.map((it) => ({
      ...it,
      itemId: it.contentId,
      itemData: jsonStringify(it.content),
      policyIds: it.policyIds,
      passed: true,
      ruleId: rule.id,
      ruleName: rule.name,
    })) as any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
  async priorVersionSamples(rule, _args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const samples =
      await context.dataSources.ruleAPI.ruleInsights.getRulePassingContentSamples(
        {
          ruleId: rule.id,
          orgId: rule.orgId,
          numSamples: 300,
          source: 'priorVersion',
        },
      );

    // TODO: type this properly. See latestVersionSamples for context.
    /* eslint-disable @typescript-eslint/no-explicit-any -- see TODO above */
    return samples.map((it) => ({
      ...it,
      itemId: it.contentId,
      itemData: jsonStringify(it.content),
      policyIds: it.policyIds,
      passed: true,
      ruleId: rule.id,
      ruleName: rule.name,
    })) as any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
};

const ReportingRuleInsights: GQLReportingRuleInsightsResolvers = {
  async passRateData(rule, args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.dataSources.ruleAPI.ruleInsights.getRulePassRateData(
      rule.id,
      rule.orgId,
      args.lookbackStartDate ? new Date(args.lookbackStartDate) : undefined,
    );
  },
  async latestVersionSamples(rule, _args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const samples =
      await context.dataSources.ruleAPI.ruleInsights.getRulePassingContentSamples(
        {
          ruleId: rule.id,
          orgId: rule.orgId,
          source: 'latestVersion',
          numSamples: 300,
        },
      );

    // TODO: type this properly. graphql queries would throw an exception if
    // asking for fields that aren't populated here. To provide them, we'll
    // have to update (and add better typings for) getRulePassingContentSamples.
    /* eslint-disable @typescript-eslint/no-explicit-any -- see TODO above */
    return samples.map((it) => ({
      ...it,
      itemId: it.contentId,
      itemData: jsonStringify(it.content),
      policyIds: it.policyIds,
      passed: true,
      ruleId: rule.id,
      ruleName: rule.name,
    })) as any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
  async priorVersionSamples(rule, _args, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const samples =
      await context.dataSources.ruleAPI.ruleInsights.getRulePassingContentSamples(
        {
          ruleId: rule.id,
          orgId: rule.orgId,
          source: 'priorVersion',
          numSamples: 300,
        },
      );

    // TODO: type this properly. See latestVersionSamples for context.
    /* eslint-disable @typescript-eslint/no-explicit-any -- see TODO above */
    return samples.map((it) => ({
      ...it,
      itemId: it.contentId,
      itemData: jsonStringify(it.content),
      policyIds: it.policyIds,
      passed: true,
      ruleId: rule.id,
      ruleName: rule.name,
    })) as any[];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  },
};

const Query: GQLQueryResolvers = {
  async getUserStrikeCountDistribution(_, __, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    const allUserStrikeCounts =
      await context.services.UserStrikeService.getAllUserStrikeCountsForOrg(
        user.orgId,
      );
    const bucketedStrikeCounts = lodash.countBy(
      allUserStrikeCounts,
      (it) => it.strike_count,
    );
    return Object.entries(bucketedStrikeCounts).map((bucket) => ({
      numStrikes: Number(bucket[0]),
      numUsers: bucket[1],
    }));
  },
  async getFullRuleResultForItem(_, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }
    const { ruleId, item, date, lookback } = input;
    try {
      const [samples, rule] = await Promise.all([
        context.dataSources.ruleAPI.ruleInsights.getRuleContentSamples({
          ruleId,
          orgId: user.orgId,
          source: lookback === 'LATEST' ? 'latestVersion' : 'priorVersion',
          itemIds: [item.id],
          numSamples: 1,
          dateFilter: date ?? undefined,
        }),
        context.dataSources.ruleAPI.getGraphQLRuleFromId(ruleId, user.orgId),
      ]);

      if (samples.length === 0) {
        throw makeNotFoundError('Item not found', { shouldErrorSpan: true });
      }

      const result = samples[0];

      // TODO: type this properly. graphql queries would throw an exception if
      // asking for fields that aren't populated here. To provide them, we'll
      // have to update (and add better typings for) getRulePassingContentSamples.
      /* eslint-disable @typescript-eslint/no-explicit-any -- see TODO above */
      return gqlSuccessResult(
        {
          ...result,
          itemId: result.contentId,
          itemData: jsonStringify(result.content),
          policyIds: result.policyIds,
          passed: true,
          ruleId: rule.id,
          ruleName: rule.name,
        } as any,
        'RuleExecutionResult',
      );
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch (e) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
};

const resolvers = {
  Query,
  ReportingRuleExecutionResult,
  ReportingRuleInsights,
  RuleInsights,
  RuleExecutionResult,
};

export { typeDefs, resolvers };
