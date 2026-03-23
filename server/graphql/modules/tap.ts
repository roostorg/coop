import { AuthenticationError } from 'apollo-server-express';

import { logErrorJson } from '../../utils/logging.js';

const typeDefs = /* GraphQL */ `
  type TapStats {
    repoCount: Int!
    recordCount: Int!
    outboxBuffer: Int!
    isConnected: Boolean!
  }

  type TapRepoInfo {
    did: String!
    handle: String
    recordCount: Int
    isTracked: Boolean!
  }

  type Query {
    tapStats: TapStats
    tapRepoInfo(did: String!): TapRepoInfo
  }

  type Mutation {
    tapAddRepos(dids: [String!]!): Boolean
    tapRemoveRepos(dids: [String!]!): Boolean
  }
`;

const Query: any = {
  async tapStats(_: any, __: any, context: any) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('Authenticated user required');
    }

    const tapWorker = context.services.TapConnectorWorker;
    if (!tapWorker) return null;

    const adminApi = tapWorker.getAdminApi();
    if (!adminApi) return null;

    try {
      return await adminApi.getStats();
    } catch (error) {
      logErrorJson({ message: 'Failed to fetch Tap stats', error });
      return null;
    }
  },

  async tapRepoInfo(_: any, { did }: { did: string }, context: any) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('Authenticated user required');
    }

    const tapWorker = context.services.TapConnectorWorker;
    if (!tapWorker) return null;

    const adminApi = tapWorker.getAdminApi();
    if (!adminApi) return null;

    try {
      return await adminApi.getRepoInfo(did);
    } catch (error) {
      logErrorJson({ message: 'Failed to fetch Tap repo info', error });
      return null;
    }
  },
};

const Mutation: any = {
  async tapAddRepos(_: any, { dids }: { dids: string[] }, context: any) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('Authenticated user required');
    }
    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage Tap repos',
      );
    }

    const tapWorker = context.services.TapConnectorWorker;
    if (!tapWorker) return false;

    const adminApi = tapWorker.getAdminApi();
    if (!adminApi) return false;

    try {
      await adminApi.addRepos(dids);
      return true;
    } catch (error) {
      logErrorJson({ message: 'Failed to add Tap repos', error });
      return false;
    }
  },

  async tapRemoveRepos(
    _: any,
    { dids }: { dids: string[] },
    context: any,
  ) {
    const user = context.getUser();
    if (!user) {
      throw new AuthenticationError('Authenticated user required');
    }
    if (!user.getPermissions().includes('MANAGE_ORG')) {
      throw new AuthenticationError(
        'User does not have permission to manage Tap repos',
      );
    }

    const tapWorker = context.services.TapConnectorWorker;
    if (!tapWorker) return false;

    const adminApi = tapWorker.getAdminApi();
    if (!adminApi) return false;

    try {
      await adminApi.removeRepos(dids);
      return true;
    } catch (error) {
      logErrorJson({ message: 'Failed to remove Tap repos', error });
      return false;
    }
  },
};

export const resolvers = { Query, Mutation };
export { typeDefs, Query, Mutation };
