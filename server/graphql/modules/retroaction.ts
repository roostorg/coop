import {
  hasPermission,
  UserPermission,
} from '../../models/types/permissioning.js';
import { type GQLMutationRunRetroactionArgs } from '../generated.js';
import { type Context } from '../resolvers.js';
import { forbiddenError, unauthenticatedError } from '../utils/errors.js';

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
      if (user == null) {
        throw unauthenticatedError('Authenticated user required');
      }
      if (!hasPermission(UserPermission.RUN_RETROACTION, user.role)) {
        throw forbiddenError('User not authorized to run retroaction.');
      }

      const rule =
        await context.services.ModerationConfigService.getRuleByIdAndOrg(
          params.input.ruleId,
          user.orgId,
        );
      if (rule == null) {
        throw forbiddenError('Invalid rule.');
      }

      return context.dataSources.ruleAPI.runRetroaction(params.input, user);
    },
  },
};

export { typeDefs, resolvers };
