import { isCoopErrorOfType, sanitizeError } from '../../utils/errors.js';
import {
  type GQLMutationDeletePolicyArgs,
  type GQLMutationResolvers,
  type GQLQueryPolicyArgs,
  type GQLQueryResolvers,
  type GQLUpdatePolicyResponseResolvers,
} from '../generated.js';
import { unauthenticatedError } from '../utils/errors.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Policy {
    id: ID!
    name: String!
    policyText: String
    enforcementGuidelines: String
    parentId: ID
    policyType: PolicyType
    userStrikeCount: Int
    applyUserStrikeCountConfigToChildren: Boolean
  }

  enum PolicyType {
    HATE
    VIOLENCE
    HARRASSMENT
    SEXUAL_CONTENT
    SPAM
    DRUG_SALES
    WEAPON_SALES
    TERRORISM
    SEXUAL_EXPLOITATION
    SELF_HARM_AND_SUICIDE
    GROOMING
    PROFANITY
    PRIVACY
    FRAUD_AND_DECEPTION
  }

  type Query {
    policy(id: ID!): Policy
  }

  input AddPolicyInput {
    id: ID
    name: String!
    policyText: String
    enforcementGuidelines: String
    parentId: ID
    parentName: String
    policyType: PolicyType
  }

  input UpdatePolicyInput {
    id: ID!
    name: String!
    policyText: String
    enforcementGuidelines: String
    parentId: ID
    policyType: PolicyType
    userStrikeCount: Int
    applyUserStrikeCountConfigToChildren: Boolean
  }

  type Mutation {
    addPolicies(policies: [AddPolicyInput!]!): AddPoliciesResponse!
    updatePolicy(input: UpdatePolicyInput!): UpdatePolicyResponse!
    deletePolicy(id: ID!): Boolean
  }

  union UpdatePolicyResponse = Policy | NotFoundError

  type PolicyNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type AddPoliciesResponse {
    policies: [Policy!]!
    failures: [String!]!
    failureDetails: [PolicyCreationFailure!]!
  }

  type PolicyCreationFailure implements Error {
    name: String!
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }
`;

const UpdatePolicyResponse: GQLUpdatePolicyResponseResolvers = {
  __resolveType(response) {
    return 'title' in response ? 'NotFoundError' : 'Policy';
  },
};

const Query: GQLQueryResolvers = {
  async policy(_: unknown, { id }: GQLQueryPolicyArgs, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ModerationConfigService.getPolicy({
      policyId: id,
      orgId: user.orgId,
    });
  },
};

const Mutation: GQLMutationResolvers = {
  async addPolicies(_: unknown, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required.');
    }

    const { policies } = params;
    const createPolicyPromises = policies.map(async (policy) =>
      context.services.ModerationConfigService.createPolicy({
        policy: {
          name: policy.name,
          parentId: policy.parentId ?? null,
          policyText: policy.policyText ?? null,
          enforcementGuidelines: policy.enforcementGuidelines ?? null,
          policyType: policy.policyType ?? null,
        },
        orgId: user.orgId,
        invokedBy: {
          userId: user.id,
          permissions: user.getPermissions(),
          orgId: user.orgId,
        },
      })
        .then((response) => ({ success: true as const, policy: response }))
        .catch((error: unknown) => ({
          success: false as const,
          name: policy.name,
          error: sanitizeError(error),
        })),
    );

    return Promise.all(createPolicyPromises).then((responses) => {
      const policies = responses
        .filter((it) => it.success)
        .map((it) => it.policy);
      const failedResponses = responses.filter((it) => !it.success);
      const failures = failedResponses.map((it) => it.name);
      const failureDetails = failedResponses.map(({ name, error }) => ({
        ...error,
        name,
      }));

      return { policies, failures, failureDetails };
    });
  },
  async updatePolicy(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required.');
    }
    try {
      const {
        id,
        name,
        policyText,
        enforcementGuidelines,
        parentId,
        policyType,
        userStrikeCount,
        applyUserStrikeCountConfigToChildren,
      } = input;

      const updatedPolicy =
        await context.services.ModerationConfigService.updatePolicy({
          policy: {
            id,
            name,
            parentId,
            policyType,
            policyText,
            enforcementGuidelines,
            userStrikeCount,
            applyUserStrikeCountConfigToChildren,
          },
          orgId: user.orgId,
          invokedBy: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        });

      return gqlSuccessResult(updatedPolicy, 'Policy');
    } catch (e) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async deletePolicy(_: unknown, params: GQLMutationDeletePolicyArgs, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('Authenticated user required');
    }

    return context.services.ModerationConfigService.deletePolicy({
      policyId: params.id,
      orgId: user.orgId,
      invokedBy: {
        userId: user.id,
        permissions: user.getPermissions(),
        orgId: user.orgId,
      },
    });
  },
};

const resolvers = {
  UpdatePolicyResponse,
  Query,
  Mutation,
};

export { typeDefs, resolvers };
