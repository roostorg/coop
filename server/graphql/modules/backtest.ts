import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

import { type Backtest } from '../../models/rules/BacktestModel.js';
import {
  hasPermission,
  UserPermission,
} from '../../models/types/permissioning.js';
import { type RuleExecutionResult } from '../datasources/RuleApi.js';
import { type GQLMutationCreateBacktestArgs } from '../generated.js';
import { type Context } from '../resolvers.js';
import {
  makeConnectionResolver,
  type ConnectionArguments,
} from '../utils/paginationHandler.js';

const typeDefs = /* GraphQL */ `
  enum BacktestStatus {
    RUNNING
    COMPLETE
    CANCELED
  }

  type Backtest {
    id: ID!
    sampleDesiredSize: Int!
    sampleActualSize: Int!
    sampleStartAt: String!
    sampleEndAt: String!
    samplingComplete: Boolean!
    contentItemsProcessed: Int!
    contentItemsMatched: Int!
    status: BacktestStatus!
    createdAt: String!
    results(
      """
      The results are always sorted according to the time they were generated,
      which is fairly arbitrary. By default, newer results, with a higher
      timestamp, are sorted first (i.e., added to the front of the paginated
      list.) You can use SortOrder.ASC to reverse that. Note that, conceptually
      cursors only apply within a given sorted collection, so changing the sort
      will "invalidate" any previously-fetched cursors. You may be able to avoid
      this by switching the pagination args you're using (e.g., using last
      instead of first), and sorting on the client.
      """
      sort: SortOrder
      before: Cursor
      after: Cursor
      first: Int
      last: Int
    ): RuleExecutionResultsConnection
  }

  type RuleExecutionResultsConnection {
    pageInfo: PageInfo!
    edges: [RuleExecutionResultEdge!]!
  }

  type RuleExecutionResultEdge {
    node: RuleExecutionResult!
    cursor: Cursor!
  }

  type Mutation {
    createBacktest(input: CreateBacktestInput!): CreateBacktestResponse
  }

  input CreateBacktestInput {
    ruleId: ID!
    sampleDesiredSize: Int!
    sampleStartAt: String!
    sampleEndAt: String!
  }

  type CreateBacktestResponse {
    backtest: Backtest!
  }
`;

const resolvers = {
  Backtest: {
    contentItemsProcessed(source: Backtest) {
      return source.correctedContentItemsProcessed;
    },
    contentItemsMatched(source: Backtest) {
      return source.correctedContentItemsMatched;
    },
    results: makeConnectionResolver<
      Backtest,
      { ts: number },
      RuleExecutionResult,
      Context,
      ConnectionArguments<{ ts: number }> & { sort?: 'ASC' | 'DESC' | null }
    >(async ({ source, context, size, cursor, takeFrom, args }) => {
      // source is the parent backtest. We need to find its id to get the results.
      const { id: backtestId } = source;
      const { sort } = args;
      return {
        items: await context.dataSources.ruleAPI.getBacktestResults(
          backtestId,
          size,
          takeFrom,
          cursor,
          sort ?? undefined,
        ),
      };
    }),
  },
  Mutation: {
    async createBacktest(
      _: unknown,
      params: GQLMutationCreateBacktestArgs,
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
      } else if (!hasPermission(UserPermission.RUN_BACKTEST, user.role)) {
        throw new ForbiddenError('User not authorized to create backtests.');
      } else if (!rule || user.orgId !== rule.orgId) {
        throw new ForbiddenError('Invalid rule.');
      }

      return {
        backtest: await context.dataSources.ruleAPI.createBacktest(
          params.input,
          user,
        ),
      };
    },
  },
};

export { typeDefs, resolvers };
