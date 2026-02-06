import { mergeResolvers } from '@graphql-tools/merge';
import { AuthenticationError } from 'apollo-server-core';
import { type GraphQLFieldResolver } from 'graphql';
import { type PassportContext } from 'graphql-passport';

import { type GQLServices } from '../api.js';
import { type DataSources } from '../iocContainer/index.js';
import { type User } from '../models/UserModel.js';
import { CoopError, isCoopErrorOfType } from '../utils/errors.js';
import {
  type GQLInviteUserToken,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from './generated.js';
import { resolvers as actionResolvers } from './modules/action.js';
import { resolvers as actionStatisticsResolvers } from './modules/actionStatistics.js';
import { resolvers as apiKeyResolvers } from './modules/apiKey.js';
import { resolvers as authenticationResolvers } from './modules/authentication.js';
import { resolvers as backtestResolvers } from './modules/backtest.js';
import { resolvers as contentTypeResolvers } from './modules/contentType.js';
import { resolvers as genericResolvers } from './modules/generic.js';
import { resolvers as insightsResolvers } from './modules/insights.js';
import { resolvers as integrationResolvers } from './modules/integration.js';
import { resolvers as investigationResolvers } from './modules/investigation.js';
import { resolvers as itemTypeResolvers } from './modules/itemType.js';
import { resolvers as locationBankResolvers } from './modules/locationBank.js';
import { resolvers as manualReviewToolResolvers } from './modules/manualReviewTool.js';
import { resolvers as hashBankResolvers } from './modules/hashBanks/resolvers.js';
import { resolvers as ncmecResolvers } from './modules/ncmec.js';
import { resolvers as orgResolvers } from './modules/org.js';
import { resolvers as policyResolvers } from './modules/policy.js';
import { resolvers as reportingResolvers } from './modules/reporting.js';
import { resolvers as reportingRulesResolvers } from './modules/reportingRule.js';
import { resolvers as retroactionResolvers } from './modules/retroaction.js';
import { resolvers as routingRulesResolvers } from './modules/routingRule.js';
import { resolvers as ruleResolvers } from './modules/rule.js';
import { resolvers as signalResolvers } from './modules/signal.js';
import { resolvers as spotTestResolvers } from './modules/spotTest.js';
import { resolvers as textBankResolvers } from './modules/textBank.js';
import { resolvers as userResolvers } from './modules/user.js';
import { gqlErrorResult, gqlSuccessResult } from './utils/gqlResult.js';

// eslint-disable-next-line @typescript-eslint/ban-types
export type Context = PassportContext<User, {}> & {
  dataSources: DataSources;
  services: GQLServices;
};

export type Resolver<Source = unknown, Args = unknown> = GraphQLFieldResolver<
  Source,
  Context,
  Args
>;

export type ResolverMap<Source = unknown> = {
  // The `any` here lets us use a different + arbitrary type for
  // the args object in each resolver, which is what we need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: Resolver<Source, any> | ResolverMap<Source>;
};

/**
 * GraphQL Query Resolvers
 */
const Query: GQLQueryResolvers = {
  async myOrg(_, __, context) {
    const user = context.getUser();
    if (user == null) {
      return null;
    }
    return context.dataSources.orgAPI.getGraphQLOrgFromId(user.orgId);
  },
  async inviteUserToken(_, { token }, { dataSources }) {
    try {
      const inviteUserToken = await dataSources.orgAPI.getInviteUserToken(
        token,
      );
      return gqlSuccessResult(
        { tokenData: inviteUserToken as unknown as GQLInviteUserToken },
        'InviteUserTokenSuccessResponse',
      );
    } catch (e: unknown) {
      if (
        isCoopErrorOfType(e, [
          'InviteUserTokenExpiredError',
          'InviteUserTokenMissingError',
        ])
      ) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async allRuleInsights(_, __, context) {
    const user = context.getUser();
    if (user == null) {
      return null;
    }

    // TODO: this response type actually isn't right; remove cast and fix errors.
    return context.dataSources.ruleAPI.getAllRuleInsights(user.orgId) as any;
  },
};

type TSignUpResponse = { data: User } | CoopError;
const SignUpResponse: ResolverMap<TSignUpResponse> = {
  __resolveType(response) {
    if (response instanceof CoopError) {
      return 'SignUpUserExistsError';
    } else {
      return 'SignUpSuccessResponse';
    }
  },
};

const Mutation: GQLMutationResolvers = {
  async signUp(_, params, context) {
    try {
      const newUser = await context.dataSources.userAPI.signUp(params, context);
      return { data: newUser };
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'SignUpUserExistsError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async sendPasswordReset(_, params, context) {
    const { email } = params.input;
    context.services.UserManagementService.sendPasswordResetEmail({
      email,
    }).catch(() => {});
    return true;
  },
  async resetPassword(_, params, context) {
    const { token, newPassword } = params.input;
    await context.services.UserManagementService.resetPasswordForToken({
      token,
      newPassword,
    });
    return true;
  },
  async generatePasswordResetToken(_, { userId }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to generate password reset tokens',
      );
    }

    const token =
      await context.services.UserManagementService.generatePasswordResetTokenForUser(
        { userId, invokerOrgId: user.orgId },
      );
    return token;
  },
  async updateRole(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    await context.services.UserManagementService.updateUserRole({
      userId: params.input.id,
      newRole: params.input.role,
      orgId: user.orgId,
      invoker: {
        userId: user.id,
        orgId: user.orgId,
        permissions: user.getPermissions(),
      },
    });

    return true;
  },
  async inviteUser(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to invite users',
      );
    }

    const token = await context.dataSources.orgAPI.inviteUser(
      params.input,
      user.orgId,
    );
    return token;
  },
  async deleteInvite(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to delete invites',
      );
    }

    return context.services.UserManagementService.deleteInvite(id, user.orgId);
  },
  async approveUser(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to approve users',
      );
    }

    return context.dataSources.userAPI.approveUser(id, user.orgId);
  },
  async rejectUser(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to reject users',
      );
    }

    return context.dataSources.userAPI.rejectUser(id, user.orgId);
  },
  async requestDemo(_, params, context) {
    return context.dataSources.orgAPI.requestDemo(params.input);
  },
};

export default mergeResolvers([
  { Query, Mutation, SignUpResponse },
  actionResolvers,
  actionStatisticsResolvers,
  apiKeyResolvers,
  authenticationResolvers,
  backtestResolvers,
  contentTypeResolvers,
  genericResolvers,
  insightsResolvers,
  integrationResolvers,
  investigationResolvers,
  itemTypeResolvers,
  locationBankResolvers,
  manualReviewToolResolvers,
  hashBankResolvers,
  ncmecResolvers,
  orgResolvers,
  policyResolvers,
  reportingResolvers,
  reportingRulesResolvers,
  retroactionResolvers,
  routingRulesResolvers,
  ruleResolvers,
  signalResolvers,
  spotTestResolvers,
  textBankResolvers,
  userResolvers,
]);
