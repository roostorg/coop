import { isCoopErrorOfType } from '../../utils/errors.js';
import { type GQLMutationLoginArgs } from '../generated.js';
import { type ResolverMap } from '../resolvers.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Query {
    me: User @publicResolver
    getSSORedirectUrl(emailAddress: String!): String
      @publicResolver
  }

  type Mutation {
    login(input: LoginInput!): LoginResponse! @publicResolver
    logout: Boolean
  }

  input LoginInput {
    email: String!
    password: String!
    remember: Boolean
  }

  type LoginSuccessResponse {
    user: User!
  }

  union LoginResponse =
      LoginSuccessResponse
    | LoginUserDoesNotExistError
    | LoginIncorrectPasswordError
    | LoginSsoRequiredError

  type LoginSsoRequiredError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type LoginUserDoesNotExistError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  type LoginIncorrectPasswordError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }
`;

const Query: ResolverMap = {
  async me(_: unknown, __: unknown, context) {
    return context.getUser();
  },
  async getSSORedirectUrl(_: unknown, { emailAddress }, context) {
    return context.services.SSOService.getSSORedirectUrlForUserEmail(
      emailAddress,
    );
  },
};

const Mutation: ResolverMap = {
  async login(_: unknown, params: GQLMutationLoginArgs, context) {
    try {
      return gqlSuccessResult(
        { user: await context.dataSources.userAPI.login(params, context) },
        'LoginSuccessResponse',
      );
    } catch (e) {
      if (isCoopErrorOfType(e, 'LoginUserDoesNotExistError')) {
        return gqlErrorResult(e, '/input/email');
      } else if (isCoopErrorOfType(e, 'LoginIncorrectPasswordError')) {
        return gqlErrorResult(e, '/input/password');
      } else {
        throw e;
      }
    }
  },
  async logout(_: unknown, __: unknown, context) {
    return context.dataSources.userAPI.logout(context);
  },
};

const resolvers = {
  Mutation,
  Query,
};

export { typeDefs, resolvers };
