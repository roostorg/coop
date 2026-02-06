import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

import {
  hasPermission,
  UserPermission,
} from '../../models/types/permissioning.js';
import { type GQLMutationRunRetroactionArgs } from '../generated.js';
import { type Context } from '../resolvers.js';

const typeDefs = /* GraphQL */ `
  type Mutation {
    runRetroaction(input: RunRetroactionInput!): RunRetroactionResponse
  }

  input RunRetroactionInput {
    ruleId: ID!
    startAt: DateTime!
    endAt: DateTime!
  }

  # future error cases will go here. for now, rather than define any, you can just
  # throw in the resolver if there was an error (which is how we always handle
  # errors that don't have specific schema types identified for them).
  union RunRetroactionResponse = RunRetroactionSuccessResponse

  # we don't need a success boolean here, because it could only ever be true
  # (given the type's name), so, instead, we just need a dummy, optional field (_)
  # to keep GQL happy.
  type RunRetroactionSuccessResponse {
    _: Boolean
  }
`;

const resolvers = {
  Mutation: {
    async runRetroaction(
      _: unknown,
      params: GQLMutationRunRetroactionArgs,
      context: Context,
    ) {
      // TODO: figure out an architecture/patterns for permission checks
      // and this type of validation. Make our error handling consistent.
      const user = context.getUser();
      const rule = await context.services.Sequelize.Rule.findByPk(
        params.input.ruleId,
      );

      if (user == null) {
        throw new AuthenticationError('Authenticated user required');
      } else if (!hasPermission(UserPermission.RUN_RETROACTION, user.role)) {
        throw new ForbiddenError('User not authorized to create backtests.');
      } else if (!rule || user.orgId !== rule.orgId) {
        throw new ForbiddenError('Invalid rule.');
      }

      return context.dataSources.ruleAPI.runRetroaction(params.input, user);
    },
  },
};

export { typeDefs, resolvers };
