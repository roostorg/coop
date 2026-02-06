import { AuthenticationError } from 'apollo-server-express';

import { isCoopErrorOfType } from '../../utils/errors.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';

const typeDefs = /* GraphQL */ `
  enum TextBankType {
    STRING
    REGEX
  }

  type TextBank {
    id: ID!
    name: String!
    description: String
    type: TextBankType!
    strings: [String!]!
  }

  input CreateTextBankInput {
    name: String!
    description: String
    type: TextBankType!
    strings: [String!]!
  }

  input UpdateTextBankInput {
    id: ID!
    name: String
    description: String
    type: TextBankType
    strings: [String!]
  }

  type MutateBankResponse {
    success: Boolean
    error: String
  }

  type Query {
    textBank(id: ID!): TextBank
  }

  type Mutation {
    createTextBank(input: CreateTextBankInput!): MutateBankResponse!
    updateTextBank(input: UpdateTextBankInput!): MutateBankResponse!
    deleteTextBank(id: ID!): Boolean!
  }
`;

const Query: GQLQueryResolvers = {
  async textBank(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const textBank =
        await context.services.ModerationConfigService.getTextBank({
          id,
          orgId: user.orgId,
        });

      return textBank;
    } catch (e) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return null;
      }
      throw e;
    }
  },
};

const Mutation: GQLMutationResolvers = {
  async createTextBank(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { name, description, type, strings } = params.input;

    try {
      await context.services.ModerationConfigService.createTextBank(
        user.orgId,
        {
          name,
          description: description ?? null,
          type,
          ownerId: null,
          strings: [...strings],
        },
      );
      return { success: true };
    } catch (e) {
      if (isCoopErrorOfType(e, 'MatchingBankNameExistsError')) {
        return { success: false, error: e.message };
      }

      throw e;
    }
  },
  async updateTextBank(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { id, name, description, type, strings } = params.input;

    try {
      await context.services.ModerationConfigService.updateTextBank(
        user.orgId,
        {
          id,
          name: name ?? undefined,
          description: description ?? null,
          type: type ?? undefined,
          strings: strings ? [...strings] : undefined,
        },
      );
      return { success: true };
    } catch (e) {
      if (isCoopErrorOfType(e, 'MatchingBankNameExistsError')) {
        return { success: false, error: e.message };
      }

      throw e;
    }
  },
  async deleteTextBank(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    try {
      const result =
        await context.services.ModerationConfigService.deleteTextBank(
          user.orgId,
          params.id,
        );
      return result;
    } catch (error) {
      return false;
    }
  },
};

const resolvers = {
  Query,
  Mutation,
};

export { typeDefs, resolvers };
