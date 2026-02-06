/* eslint-disable max-lines */
import { type DateString } from '@roostorg/types';
import { AuthenticationError } from 'apollo-server-express';
import _ from 'lodash';

import { type ConditionSetWithResult } from '../../models/rules/RuleModel.js';
import {
  getFieldValueForRole,
  type ItemSubmission,
} from '../../services/itemProcessingService/index.js';
import {
  asyncIterableToArray,
  asyncIterableToArrayWithTimeout,
  asyncIterableToArrayWithTimeoutAndLimit,
  filterNullOrUndefined,
} from '../../utils/collections.js';
import { jsonStringify } from '../../utils/encoding.js';
import { isCoopErrorOfType, makeNotFoundError } from '../../utils/errors.js';
import { MONTH_MS } from '../../utils/time.js';
import {
  type GQLQueryResolvers,
  type GQLResolversTypes,
  type GQLRuleEnvironment,
  type GQLUserHistoryResolvers,
} from '../generated.js';
import { formatItemSubmissionForGQL } from '../types.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Query {
    itemSubmissions(
      itemIdentifiers: [ItemIdentifierInput!]!
    ): [ItemSubmissions!]!
    latestItemSubmissions(itemIdentifiers: [ItemIdentifierInput!]!): [Item!]!
    latestItemsCreatedBy(
      itemIdentifier: ItemIdentifierInput!
      oldestReturnedSubmissionDate: DateTime
      earliestReturnedSubmissionDate: DateTime
    ): [ItemSubmissions!]!
    latestItemsCreatedByWithThread(
      itemIdentifier: ItemIdentifierInput!
    ): [ThreadWithMessages!]!

    userHistory(itemIdentifier: ItemIdentifierInput!): UserHistoryResponse!

    # This query enables the caller to get all item submissions for a given
    # item ID, while remaining agnostic to the item type. As such, we query
    # all item types for items with the given ID and return all results.
    itemsWithId(
      itemId: ID!
      typeId: ID
      returnFirstResultOnly: Boolean
    ): [ItemSubmissions!]!

    itemWithHistory(
      itemIdentifier: ItemIdentifierInput!
      submissionTime: DateTime
    ): ItemHistoryResponse!

    threadHistory(
      threadIdentifier: ItemIdentifierInput!
      endDate: DateTime
    ): [ItemSubmissions!]!

    itemActionHistory(
      itemIdentifier: ItemIdentifierInput!
      submissionTime: DateTime
    ): [ItemAction!]!
  }

  type ItemHistoryResult {
    item: Item!
    executions: [RuleExecutionResult!]!
  }

  union ItemHistoryResponse = ItemHistoryResult | NotFoundError

  type PolicyActionCount {
    actionId: String!
    policyId: String
    actorId: String
    itemSubmissionIds: [String!]!
    count: Int!
  }

  type UserSubmissionCount {
    itemTypeId: String!
    count: Int!
  }

  type UserActionsHistory {
    countsByPolicy: [PolicyActionCount!]!
  }

  type UserSubmissionsHistory {
    countsByItemType: [UserSubmissionCount!]!
  }

  type UserHistory {
    id: ID!
    user: UserItem
    executions: [RuleExecutionResult!]!
    actions: UserActionsHistory!
    submissions: UserSubmissionsHistory!
  }

  type ThreadWithMessages {
    threadId: ID!
    threadTypeId: ID!
    messages: [ItemSubmissions!]!
  }

  union UserHistoryResponse = UserHistory | NotFoundError

  type ItemAction {
    itemId: ID!
    itemTypeId: ID!
    itemCreatorId: ID
    itemCreatorTypeId: ID
    actionId: ID!
    actorId: ID
    jobId: ID
    policies: [String!]!
    ruleIds: [ID!]!
    ts: DateTime!
  }
`;

const UserHistory: GQLUserHistoryResolvers = {
  async executions(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const rows =
      await context.services.UserHistoryQueries.getUserRuleExecutionsHistory(
        user.orgId,
        { id: it.user.id, typeId: it.user.type.id },
      );
    return rows.map((row) => ({
      ...row,
      content:
        typeof row.content === 'string'
          ? row.content
          : jsonStringify(row.content as object),
      result: row.result as ConditionSetWithResult | null,
      environment: row.environment as GQLRuleEnvironment,
    }));
  },
  async actions(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const actions =
      await context.services.UserStatisticsService.getUserActionCountsByPolicy(
        user.orgId,
        { id: it.user.id, typeId: it.user.type.id },
      );

    return { countsByPolicy: actions };
  },
  async submissions(it, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const submissions =
      await context.services.UserStatisticsService.getUserSubmissionCount(
        user.orgId,
        { id: it.user.id, typeId: it.user.type.id },
      );

    return { countsByItemType: submissions };
  },
};

const Query: GQLQueryResolvers = {
  async itemSubmissions(_, { itemIdentifiers }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const items = await Promise.all(
      itemIdentifiers.map(async (itemIdentifier) =>
        context.services.ItemInvestigationService.getItemByIdentifier({
          orgId: user.orgId,
          itemIdentifier,
          latestSubmissionOnly: false,
        }),
      ),
    );

    return filterNullOrUndefined(items).map((it) => ({
      latest: formatItemSubmissionForGQL(it.latestSubmission),
      prior: it.priorSubmissions?.map((priorSubmission) =>
        formatItemSubmissionForGQL(priorSubmission),
      ),
    }));
  },
  async latestItemSubmissions(_, { itemIdentifiers }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const items = await Promise.all(
      itemIdentifiers.map(async (itemIdentifier) =>
        context.services.ItemInvestigationService.getItemByIdentifier({
          orgId: user.orgId,
          itemIdentifier,
        }),
      ),
    );

    return filterNullOrUndefined(items).map((it) =>
      formatItemSubmissionForGQL(it.latestSubmission),
    );
  },
  async userHistory(_, { itemIdentifier }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    try {
      const userItem =
        await context.services.ItemInvestigationService.getItemByIdentifier({
          orgId: user.orgId,
          itemIdentifier,
          latestSubmissionOnly: true,
        });

      if (userItem === null) {
        return gqlErrorResult(
          makeNotFoundError('User not found', { shouldErrorSpan: true }),
        );
      }

      return gqlSuccessResult(
        {
          id: itemIdentifier.id,
          user: formatItemSubmissionForGQL(userItem.latestSubmission),
        },
        'UserHistory',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'NotFoundError')) {
        return gqlErrorResult(e);
      }

      throw e;
    }
  },
  async itemsWithId(_, { itemId, typeId, returnFirstResultOnly }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    if (typeId) {
      const item =
        await context.services.ItemInvestigationService.getItemByIdentifier({
          orgId: user.orgId,
          itemIdentifier: { id: itemId, typeId },
          latestSubmissionOnly: true,
        });

      if (item == null) {
        return [];
      }

      return [
        {
          latest: formatItemSubmissionForGQL(item.latestSubmission),
          prior: item.priorSubmissions?.map((priorSubmission: ItemSubmission) =>
            formatItemSubmissionForGQL(priorSubmission),
          ),
        },
      ];
    }

    const itemsAsyncIterator =
      context.services.ItemInvestigationService.getItemByTypeAgnosticIdentifier(
        {
          orgId: user.orgId,
          itemId,
          latestSubmissionOnly: true,
        },
      );

    if (returnFirstResultOnly) {
      const items = await asyncIterableToArrayWithTimeoutAndLimit(
        itemsAsyncIterator,
        25_000,
        1,
      );

      if (items.length === 0) {
        return [];
      }

      const item = items[0];
      return [
        {
          latest: formatItemSubmissionForGQL(item.latestSubmission),
          prior: item.priorSubmissions?.map((priorSubmission: ItemSubmission) =>
            formatItemSubmissionForGQL(priorSubmission),
          ),
        },
      ];
    } else {
      const items = await asyncIterableToArrayWithTimeout(
        itemsAsyncIterator,
        // Set to 25 seconds to avoid long-running requests and we
        // want to make sure we get some results in the event of a possible
        // timeout (which is why we're using an async iterable in the first
        // place instead of just returning an array)
        25_000,
      );

      return items.map((it) => ({
        latest: formatItemSubmissionForGQL(it.latestSubmission),
        prior: it.priorSubmissions?.map((priorSubmission) =>
          formatItemSubmissionForGQL(priorSubmission),
        ),
      }));
    }
  },
  async itemWithHistory(_, { itemIdentifier, submissionTime }, context) {
    const { id: itemId, typeId } = itemIdentifier;
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const item =
      await context.services.ItemInvestigationService.getItemByIdentifier({
        orgId: user.orgId,
        itemIdentifier: { id: itemId, typeId },
        latestSubmissionOnly: true,
      });

    if (item == null) {
      return gqlErrorResult(
        makeNotFoundError('Item not found', { shouldErrorSpan: true }),
      );
    }

    const itemExecutionHistory =
      await context.dataSources.investigationAPI.getItemHistory({
        itemId: item.latestSubmission.itemId,
        itemTypeId: item.latestSubmission.itemType.id,
        orgId: user.orgId,
        itemSubmissionTime: submissionTime
          ? new Date(submissionTime)
          : undefined,
      });

    const result = gqlSuccessResult(
      {
        item: formatItemSubmissionForGQL(item.latestSubmission),
        // TODO: Fix casting here
        executions: itemExecutionHistory as ReadonlyArray<
          GQLResolversTypes['RuleExecutionResult']
        >,
      },
      'ItemHistoryResult',
    );

    return result;
  },

  async threadHistory(_, { threadIdentifier, endDate }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }
    const threadSubmissions = await asyncIterableToArray(
      context.services.ItemInvestigationService.getThreadSubmissionsByTime({
        orgId: user.orgId,
        threadId: threadIdentifier,
        limit: 20,
        numParentLevels: 0,
        newestReturnedSubmissionDate: endDate ? new Date(endDate) : new Date(),
        // The ItemInvestigationService only has the last 30 days of submission
        // data, but it's possible that the createdAt date of items in a thread
        // is older than their submission date, so here we manually set the date
        // range to 12 months to account for new submissions of old date.
        oldestReturnedSubmissionDate: new Date(Date.now() - MONTH_MS * 12),
      }),
    );

    return threadSubmissions.map((itemSubmissions) => {
      const { latestSubmission, priorSubmissions = [] } = itemSubmissions;
      return {
        latest: formatItemSubmissionForGQL(latestSubmission),
        prior: priorSubmissions.map(formatItemSubmissionForGQL),
      };
    });
  },

  async latestItemsCreatedBy(
    _,
    {
      itemIdentifier,
      oldestReturnedSubmissionDate,
      earliestReturnedSubmissionDate,
    },
    context,
  ) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }
    const items = await asyncIterableToArray(
      context.services.ItemInvestigationService.getItemSubmissionsByCreator({
        orgId: user.orgId,
        itemCreatorIdentifier: itemIdentifier,
        oldestReturnedSubmissionDate: oldestReturnedSubmissionDate
          ? new Date(oldestReturnedSubmissionDate)
          : undefined,
        earliestReturnedSubmissionDate: earliestReturnedSubmissionDate
          ? new Date(earliestReturnedSubmissionDate)
          : undefined,
      }),
    );

    return items.map((contentItems) => {
      const { latestSubmission, priorSubmissions = [] } = contentItems;

      const formattedItem = formatItemSubmissionForGQL(latestSubmission);
      const formattedPriors = priorSubmissions.map(formatItemSubmissionForGQL);

      return {
        latest: formattedItem,
        prior: formattedPriors,
      };
    });
  },

  async latestItemsCreatedByWithThread(__, { itemIdentifier }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }

    const items = await asyncIterableToArray(
      context.services.ItemInvestigationService.getItemSubmissionsByCreator({
        orgId: user.orgId,
        itemCreatorIdentifier: itemIdentifier,
      }),
    );

    const threadsWithCreatedAt = filterNullOrUndefined(
      items.map((contextItem) => {
        const latestSubmission = contextItem.latestSubmission;
        if (latestSubmission.itemType.kind !== 'CONTENT') {
          return undefined;
        }
        const thread = getFieldValueForRole(
          latestSubmission.itemType.schema,
          latestSubmission.itemType.schemaFieldRoles,
          'threadId',
          latestSubmission.data,
        );
        if (thread == null) {
          return undefined;
        }
        return {
          thread,
          createdAt: getFieldValueForRole(
            latestSubmission.itemType.schema,
            latestSubmission.itemType.schemaFieldRoles,
            'createdAt',
            latestSubmission.data,
          ),
        };
      }),
    );

    const uniqueThreadsWithLatestDates = _.sortBy(
      Object.values(
        threadsWithCreatedAt.reduce<{
          [key: string]: {
            thread: { id: string; typeId: string };
            createdAt: DateString | undefined;
          };
        }>((result, threadWithDate) => {
          const key = `${threadWithDate.thread.id}-${threadWithDate.thread.typeId}`;
          const existing = result[key];
          if (
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            !existing ||
            !existing.createdAt ||
            (threadWithDate.createdAt &&
              existing.createdAt &&
              threadWithDate.createdAt > existing.createdAt)
          ) {
            result[key] = threadWithDate;
          }
          return result;
        }, {}),
      ),
      (threadWithCreatedAt) => threadWithCreatedAt.createdAt,
    )
      .reverse()
      .slice(0, 10);

    return Promise.all(
      uniqueThreadsWithLatestDates.map(async (threadWithCreatedAt) => {
        const date = threadWithCreatedAt.createdAt
          ? new Date(threadWithCreatedAt.createdAt)
          : new Date();
        const submissions = await asyncIterableToArray(
          context.services.ItemInvestigationService.getThreadSubmissionsByTime({
            orgId: user.orgId,
            threadId: {
              id: threadWithCreatedAt.thread.id,
              typeId: threadWithCreatedAt.thread.typeId,
            },
            limit: 50,
            numParentLevels: 0,
            // Add a buffer of 3 hours to get trailing context
            newestReturnedSubmissionDate: new Date(
              date.setHours(date.getHours() + 3),
            ),
          }),
        );
        return {
          threadId: threadWithCreatedAt.thread.id,
          threadTypeId: threadWithCreatedAt.thread.typeId,
          messages: submissions.map((contentItems) => {
            const { latestSubmission, priorSubmissions = [] } = contentItems;

            const formattedItem = formatItemSubmissionForGQL(latestSubmission);
            const formattedPriors = priorSubmissions.map(
              formatItemSubmissionForGQL,
            );

            return {
              latest: formattedItem,
              prior: formattedPriors,
            };
          }),
        };
      }),
    );
  },

  async itemActionHistory(_, { itemIdentifier, submissionTime }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Unauthenticated User');
    }
    return context.services.ItemInvestigationService.getItemActionHistory({
      orgId: user.orgId,
      itemId: itemIdentifier.id,
      itemTypeId: itemIdentifier.typeId,
      itemSubmissionTime: submissionTime ? new Date(submissionTime) : undefined,
    });
  },
};

const resolvers = {
  Query,
  UserHistory,
};

export { typeDefs, resolvers };
