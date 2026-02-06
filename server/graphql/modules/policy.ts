import { AuthenticationError } from 'apollo-server-core';
import _ from 'lodash';

import { type Policy } from '../../models/PolicyModel.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import {
  type GQLMutationDeletePolicyArgs,
  type GQLMutationResolvers,
  type GQLQueryPolicyArgs,
  type GQLQueryResolvers,
  type GQLUpdatePolicyResponseResolvers,
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const { partition } = _;

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
      throw new AuthenticationError('Authenticated user required');
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
      throw new AuthenticationError('Authenticated user required.');
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
        .catch(() => ({ success: false as const, name: policy.name })),
    );

    return Promise.all(createPolicyPromises).then((responses) => {
      const [successResponses, failedResponses] = partition(
        responses,
        (it) => it.success,
      );
      // NB: The casts below are safe. We have to do them because lodash's
      // partition function isn't smart enough to narrow the types appropriately
      // from the response union type
      const policies = (
        successResponses as unknown as { policy: Policy }[]
      ).map((it: { policy: Policy }) => it.policy);
      const failures = (failedResponses as { name: string }[]).map(
        (it) => it.name,
      );

      return { policies, failures };
    });
  },
  async updatePolicy(_: unknown, { input }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required.');
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
      throw new AuthenticationError('Authenticated user required');
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
