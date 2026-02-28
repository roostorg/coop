/* eslint-disable max-lines */
import { AuthenticationError } from 'apollo-server-express';

import { isConditionSet } from '../../condition_evaluator/condition.js';
import {
  getNameForDerivedField,
  type DerivedFieldSpec as TDerivedFieldSpec,
} from '../../services/derivedFieldsService/index.js';
import {
  CoopInput,
  type ConditionInput,
  type LeafCondition,
} from '../../services/moderationConfigService/index.js';
import { isSignalId } from '../../services/signalsService/index.js';
import { jsonParse } from '../../utils/encoding.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  type GQLConditionResolvers,
  type GQLConditionWithResultResolvers,
  type GQLContentRuleResolvers,
  type GQLLeafConditionResolvers,
  type GQLLeafConditionWithResultResolvers,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
  type GQLRuleResolvers,
  type GQLUserRuleResolvers,
} from '../generated.js';
import { type Context, type ResolverMap } from '../resolvers.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Query {
    rule(id: ID!): Rule
  }

  type Mutation {
    createContentRule(
      input: CreateContentRuleInput!
    ): CreateContentRuleResponse!
    updateContentRule(
      input: UpdateContentRuleInput!
    ): UpdateContentRuleResponse!
    createUserRule(input: CreateUserRuleInput!): CreateUserRuleResponse!
    updateUserRule(input: UpdateUserRuleInput!): UpdateUserRuleResponse!
    deleteRule(id: ID!): Boolean
  }

  interface Rule {
    id: ID!
    parentId: ID
    name: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
    description: String
    status: RuleStatus!
    conditionSet: ConditionSet!
    actions: [Action!]!
    policies: [Policy!]!
    tags: [String]
    # GraphQL doesn't support BIGINT, so this must be a Float
    maxDailyActions: Float
    expirationTime: String
    backtests(ids: [ID!]): [Backtest!]!
    insights: RuleInsights!
  }

  type ContentRule implements Rule {
    id: ID!
    parentId: ID
    name: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
    description: String
    status: RuleStatus!
    conditionSet: ConditionSet!
    actions: [Action!]!
    policies: [Policy!]!
    tags: [String]
    maxDailyActions: Float
    expirationTime: String
    backtests(ids: [ID!]): [Backtest!]!
    insights: RuleInsights!
    # Content rule specific fields
    itemTypes: [ItemType!]!
  }

  type UserRule implements Rule {
    id: ID!
    parentId: ID
    name: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
    description: String
    status: RuleStatus!
    conditionSet: ConditionSet!
    actions: [Action!]!
    policies: [Policy!]!
    tags: [String]
    maxDailyActions: Float
    expirationTime: String
    backtests(ids: [ID!]): [Backtest!]!
    insights: RuleInsights!
  }

  # ConditionSetWithResult holds all the info we need to display the rule's
  # conditions, and each of their results, on a single piece of content.
  # It's identical to the backend TS type ConditionSetWithResultAsLogged,
  # because it only has the subset of the fields that we bother to store in
  # Snowflake about a rule execution.
  type ConditionSetWithResult {
    conjunction: ConditionConjunction
    conditions: [ConditionWithResult!]!
    # If undefined, it means the condition set was skipped.
    # OR, the condition was run before we started logging results.
    result: ConditionResult
  }

  union ConditionWithResult = LeafConditionWithResult | ConditionSetWithResult

  type LeafConditionWithResult {
    input: ConditionInputField!
    signal: Signal
    matchingValues: MatchingValues
    comparator: ValueComparator
    threshold: StringOrFloat
    # If undefined, it means the condition was skipped.
    result: ConditionResult
  }

  enum RuleStatus {
    BACKGROUND
    DRAFT
    DEPRECATED
    EXPIRED
    LIVE
    ARCHIVED
  }

  enum ConditionConjunction {
    AND
    OR
    XOR
  }

  type ConditionSet {
    conjunction: ConditionConjunction!
    conditions: [Condition!]!
  }

  union Condition = ConditionSet | LeafCondition

  type LeafCondition {
    input: ConditionInputField!
    signal: Signal
    matchingValues: MatchingValues
    comparator: ValueComparator
    threshold: StringOrFloat
  }

  # Ideally, this should be a union (mirroring ConditionInput on the backend),
  # but Gql doesn't support union input types, so this is easier.
  # !! IMPORTANT: Keep this in sync with ConditionInputFieldInput
  type ConditionInputField {
    type: ConditionInputInputType!
    name: CoopInputOrString
    contentTypeId: String
    contentTypeIds: [String!]
    spec: DerivedFieldSpec
  }

  enum ConditionInputInputType {
    USER_ID
    CONTENT_FIELD
    CONTENT_COOP_INPUT
    FULL_ITEM
    CONTENT_DERIVED_FIELD
  }

  type MatchingValues {
    strings: [String!]
    textBankIds: [String!]
    locations: [LocationArea!]
    locationBankIds: [String!]
    imageBankIds: [String!]
  }

  type DerivedFieldSpec {
    source: DerivedFieldSource!
    derivationType: DerivedFieldDerivationType!
  }

  input DerivedFieldSpecInput {
    source: DerivedFieldSourceInput!
    derivationType: DerivedFieldDerivationType!
  }

  enum DerivedFieldDerivationType {
    ENGLISH_TRANSLATION
    VIDEO_TRANSCRIPTION
  }

  union DerivedFieldSource =
      DerivedFieldFullItemSource
    | DerivedFieldFieldSource
    | DerivedFieldCoopInputSource

  # NB: This is a more cumbersome approach compared to what we've used
  # previously to handle input union types (e.g., in ConditionInputField).
  # However, it is more type safe and is forward compatible with
  # https://github.com/graphql/graphql-spec/pull/825, which is nice.
  input DerivedFieldSourceInput {
    fullItem: DerivedFieldFullItemSourceInput
    contentField: DerivedFieldFieldSourceInput
    contentCoopInput: DerivedFieldCoopInputSourceInput
  }

  # Re the _ field, see https://github.com/graphql/graphql-spec/issues/568 and
  # https://github.com/graphql/graphql-spec/pull/825#issuecomment-1182979316
  type DerivedFieldFullItemSource {
    _: Boolean
  }
  input DerivedFieldFullItemSourceInput {
    _: Boolean
  }

  type DerivedFieldFieldSource {
    name: String!
    contentTypeId: String!
  }
  input DerivedFieldFieldSourceInput {
    name: String!
    contentTypeId: String!
  }

  type DerivedFieldCoopInputSource {
    name: CoopInput!
  }
  input DerivedFieldCoopInputSourceInput {
    name: CoopInput!
  }

  enum CoopInput {
    ALL_TEXT
    ANY_IMAGE
    ANY_GEOHASH
    ANY_VIDEO
    AUTHOR_USER
    POLICY_ID
    SOURCE
  }

  input ConditionMatchingValuesInput {
    strings: [String!]
    textBankIds: [String!]
    locations: [LocationAreaInput!]
    locationBankIds: [String!]
    imageBankIds: [String!]
  }

  # Allows user to see the evaluation result of each condition
  type ConditionResult {
    outcome: ConditionOutcome!

    # Represents computed results from a single condition - e.g.
    # 3P model scores, similarity scores, bool evaluations, etc.
    # It has to be a String because there is no concept of the 'any'
    # type (or even union types like string | number) in GraphQL. So
    # no matter what the score type actually is, we pass it to the client
    # as a string
    score: String

    # Represents the value on which the input was matched against for
    # signals that require matching values. For example, this would be
    # the matched regex in a regex bank that triggered the rule.
    matchedValue: String
  }

  enum ConditionOutcome {
    PASSED
    FAILED
    INAPPLICABLE
    ERRORED
  }

  input CreateContentRuleInput {
    name: String!
    description: String
    status: RuleStatus!
    contentTypeIds: [ID!]!
    conditionSet: ConditionSetInput!
    actionIds: [ID!]!
    policyIds: [ID!]!
    tags: [String!]!
    # GraphQL doesn't support BIGINT, so this must be a Float
    maxDailyActions: Float
    expirationTime: DateTime
    parentId: ID
  }

  input UpdateContentRuleInput {
    id: ID!
    name: String
    description: String
    status: RuleStatus
    contentTypeIds: [ID!]
    conditionSet: ConditionSetInput
    actionIds: [ID!]
    policyIds: [ID!]
    tags: [String!]
    # GraphQL doesn't support BIGINT, so this must be a Float
    maxDailyActions: Float
    expirationTime: DateTime
    cancelRunningBacktests: Boolean
    parentId: ID
  }

  input CreateUserRuleInput {
    name: String!
    description: String
    status: RuleStatus!
    conditionSet: ConditionSetInput!
    actionIds: [ID!]!
    policyIds: [ID!]!
    tags: [String!]!
    # GraphQL doesn't support BIGINT, so this must be a Float
    maxDailyActions: Float
    expirationTime: DateTime
    parentId: ID
  }

  input UpdateUserRuleInput {
    id: ID!
    name: String
    description: String
    status: RuleStatus
    conditionSet: ConditionSetInput
    actionIds: [ID!]
    policyIds: [ID!]
    tags: [String!]
    # GraphQL doesn't support BIGINT, so this must be a Float
    maxDailyActions: Float
    expirationTime: DateTime
    cancelRunningBacktests: Boolean
    parentId: ID
  }

  input ConditionSetInput {
    conjunction: ConditionConjunction!
    conditions: [ConditionInput!]!
  }

  # This needs to be able to represent a ConditionSet or a LeafCondition,
  # but Graphql union input type support is WIP (https://github.com/graphql/graphql-spec/pull/825),
  # so we have fields here for both.
  input ConditionInput {
    # LeafCondition fields
    input: ConditionInputFieldInput
    signal: ConditionInputSignalInput
    matchingValues: ConditionMatchingValuesInput
    comparator: ValueComparator
    threshold: StringOrFloat

    # ConditionSet fields
    conjunction: ConditionConjunction
    conditions: [ConditionInput!]
  }

  input ConditionInputSignalInput {
    id: ID! # JsonOf<SignalId>
    type: String!
    name: String
    subcategory: String
    args: SignalArgsInput
  }

  input SignalSubcategoryInput {
    name: String
    options: [SignalSubcategoryOptionInput]
  }

  input SignalSubcategoryOptionInput {
    name: String
    description: String
  }

  input DisabledInfoInput {
    disabled: Boolean
    disabledMessage: String
  }

  # Ideally, this should be a union (mirroring ConditionInput on the backend),
  # but Gql doesn't support union input types, so this is easier.
  #
  # !! IMPORTANT: Keep this in sync with ConditionInputField
  input ConditionInputFieldInput {
    type: ConditionInputInputType!
    name: CoopInputOrString
    contentTypeId: String
    contentTypeIds: [String!]
    spec: DerivedFieldSpecInput
  }

  type RuleNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  input SignalArgsInput {
    AGGREGATION: AggregationSignalArgsInput
  }

  input AggregationSignalArgsInput {
    aggregationClause: AggregationClauseInput!
  }

  input AggregationClauseInput {
    aggregation: AggregationInput!
    conditionSet: ConditionSetInput
    groupBy: [ConditionInputFieldInput!]!
    window: WindowConfigurationInput!
  }

  input WindowConfigurationInput {
    sizeMs: Int!
    hopMs: Int!
  }

  input AggregationInput {
    type: AggregationType!
  }



  type RuleHasRunningBacktestsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union CreateContentRuleResponse =
      MutateContentRuleSuccessResponse
    | RuleNameExistsError

  union UpdateContentRuleResponse =
      MutateContentRuleSuccessResponse
    | RuleNameExistsError
    | RuleHasRunningBacktestsError
    | NotFoundError

  union CreateUserRuleResponse =
      MutateUserRuleSuccessResponse
    | RuleNameExistsError

  union UpdateUserRuleResponse =
      MutateUserRuleSuccessResponse
    | RuleNameExistsError
    | RuleHasRunningBacktestsError
    | NotFoundError

  type MutateContentRuleSuccessResponse {
    data: ContentRule!
  }

  type MutateUserRuleSuccessResponse {
    data: UserRule!
  }
`;

const Query: GQLQueryResolvers = {
  async rule(_, { id }, { dataSources, getUser }) {
    const user = await getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return dataSources.ruleAPI.getGraphQLRuleFromId(id, user.orgId);
  },
};

const Mutation: GQLMutationResolvers = {
  async createContentRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const rule = await context.dataSources.ruleAPI.createContentRule(
        params.input,
        user.id,
        user.orgId,
      );

      return gqlSuccessResult(
        { data: rule },
        'MutateContentRuleSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'RuleNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async updateContentRule(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('Authenticated user required');
      }

      const rule = await context.dataSources.ruleAPI.updateContentRule({
        input: params.input,
        orgId: user.orgId,
      });
      return gqlSuccessResult(
        { data: rule },
        'MutateContentRuleSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'RuleNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      if (isCoopErrorOfType(e, 'RuleHasRunningBacktestsError')) {
        return gqlErrorResult(e, `/input/cancelRunningBacktests`);
      }

      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e, `/input/id`);
      }

      throw e;
    }
  },
  async createUserRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const rule = await context.dataSources.ruleAPI.createUserRule(
        params.input,
        user.id,
        user.orgId,
      );

      return gqlSuccessResult({ data: rule }, 'MutateUserRuleSuccessResponse');
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'RuleNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async updateUserRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const rule = await context.dataSources.ruleAPI.updateUserRule({
        input: params.input,
        orgId: user.orgId,
      });
      return gqlSuccessResult({ data: rule }, 'MutateUserRuleSuccessResponse');
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'RuleNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      if (isCoopErrorOfType(e, 'RuleHasRunningBacktestsError')) {
        return gqlErrorResult(e, `/input/cancelRunningBacktests`);
      }

      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e, `/input/id`);
      }

      throw e;
    }
  },
  async deleteRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.dataSources.ruleAPI.deleteRule({
      id: params.id,
      orgId: user.orgId,
    });
  },
};

const ConditionInputField: ResolverMap<ConditionInput> = {
  async name(conditionInputField, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (conditionInputField.type !== 'CONTENT_DERIVED_FIELD') {
      return (conditionInputField as { name?: string }).name ?? null;
    } else {
      return getNameForDerivedField(conditionInputField.spec);
    }
  },
};

const Rule: GQLRuleResolvers = {
  async __resolveType(rule) {
    switch (rule.ruleType) {
      case 'CONTENT':
        return 'ContentRule';
      case 'USER':
        return 'UserRule';
      default:
        assertUnreachable(rule.ruleType);
    }
  },
};

const ContentRule: GQLContentRuleResolvers = {
  async creator(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getCreator();
  },
  async itemTypes(rule, _, { services, getUser }) {
    const user = getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    return services.ModerationConfigService.getItemTypesForRule({
      orgId: user.orgId,
      ruleId: rule.id,
    });
  },
  async actions(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getActions();
  },
  async policies(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getPolicies();
  },
  async backtests(rule, args, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const { ids } = args;
    return context.dataSources.ruleAPI.getBacktestsForRule(rule.id, ids);
  },
  async insights(rule, _args, context) {
    // just return the rule, which then becomes the parent/source for the
    // insights resolver. But verify the rule is owned by the user's org
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required');
    }

    if (rule.orgId !== user.orgId) {
      throw new Error("Rule does not belong to user's org");
    }

    return rule;
  },
};

const UserRule: GQLUserRuleResolvers = {
  async creator(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getCreator();
  },
  async actions(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getActions();
  },
  async policies(rule, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return rule.getPolicies();
  },
  async backtests(rule, args, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const { ids } = args;
    return context.dataSources.ruleAPI.getBacktestsForRule(rule.id, ids);
  },
  async insights(rule, _args, context) {
    // just return the rule, which then becomes the parent/source for the
    // insights resolver. But verify the rule is owned by the user's org
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (rule.orgId !== user.orgId) {
      throw new Error("Rule does not belong to user's org");
    }

    return rule;
  },
};

const Condition: GQLConditionResolvers = {
  __resolveType(condition) {
    return isConditionSet(condition) ? 'ConditionSet' : 'LeafCondition';
  },
};

const ConditionWithResult: GQLConditionWithResultResolvers = {
  __resolveType(conditionWithResult) {
    return 'conditions' in conditionWithResult
      ? 'ConditionSetWithResult'
      : 'LeafConditionWithResult';
  },
};

const signalForStoredCondition = async (
  condition: Pick<LeafCondition, 'signal'>,
  _args: unknown,
  context: Context,
) => {
  const user = context.getUser();
  if (!condition.signal || !user) return null;

  const signalId = jsonParse(condition.signal.id);

  // Handle case of a stored signal id that's no longer valid (e.g., cuz the
  // underlying signal's been deleted.)
  if (!isSignalId(signalId)) return null;

  const signal = await context.services.SignalsService.getSignal({
    signalId,
    // TODO: In the context of an individual condition, it's pretty hard
    // to get the org that owns the rule that contains the condition. We
    // should make that easier (how?) but, for now, we can just assume
    // that the rule is owned by the same org as the user.
    orgId: user.orgId,
  });
  if (!signal) {
    return null;
  }

  return {
    ...signal,
    subcategory: condition.signal.subcategory ?? undefined,
    args: condition.signal.args,
  };
};

const LeafCondition: GQLLeafConditionResolvers = {
  signal: signalForStoredCondition,
};

const LeafConditionWithResult: GQLLeafConditionWithResultResolvers = {
  signal: signalForStoredCondition,
};

const DerivedFieldSource: ResolverMap<TDerivedFieldSpec['source']> = {
  __resolveType(derivedFieldSource) {
    const { type } = derivedFieldSource;
    switch (type) {
      case 'FULL_ITEM':
        return 'DerivedFieldFullItemSource';
      case 'CONTENT_FIELD':
        return 'DerivedFieldFieldSource';
      case 'CONTENT_COOP_INPUT':
        return 'DerivedFieldCoopInputSource';
      default:
        assertUnreachable(type);
    }
  },
};

const resolvers = {
  Query,
  Mutation,
  Rule,
  ContentRule,
  UserRule,
  Condition,
  LeafCondition,
  ConditionWithResult,
  LeafConditionWithResult,
  DerivedFieldSource,
  ConditionInputField,
  // Use the CoopInput enum directly as the resolver, to map the incoming GQL
  // names, which happen to match the TS enum case names, to the underlying string
  // values.
  //
  // NB: In some places, the GQL API outputs what's internally a CoopInput,
  // but the GQL Schema doesn't yet declare it as such. Accordingly, those values
  // won't go through this resolver, and will end up inconsistent (making their
  // way to the frontend as the internal TS value, rather than as the enum case).
  // That's ok, because it's not a backwards compatibility break; we'll just
  // gradually update the schema to actually use the enum.
  CoopInput,
};

export { typeDefs, resolvers };
