import { AuthenticationError, ForbiddenError } from 'apollo-server-express';
import jwt from 'jsonwebtoken';

import {
  type GQLGetDecisionCountSettings,
  type GQLGetJobCreationCountSettings,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
  type GQLUserResolvers,
} from '../generated.js';
import { gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  enum UserRole {
    ADMIN
    RULES_MANAGER
    ANALYST
    MODERATOR_MANAGER
    MODERATOR
    CHILD_SAFETY_MODERATOR
    EXTERNAL_MODERATOR
  }

  enum UserPermission {
    MANAGE_ORG
    MUTATE_LIVE_RULES
    MUTATE_NON_LIVE_RULES
    RUN_RETROACTION
    RUN_BACKTEST
    VIEW_INSIGHTS
    MANUALLY_ACTION_CONTENT
    VIEW_MRT
    VIEW_MRT_DATA
    EDIT_MRT_QUEUES
    VIEW_CHILD_SAFETY_DATA
    MANAGE_POLICIES
    VIEW_INVESTIGATION
    VIEW_RULES_DASHBOARD
  }

  enum UserPenaltySeverity {
    NONE
    LOW
    MEDIUM
    HIGH
    SEVERE
  }

  # TODO: figure out if role can really be null. Also, squash approvedByAdmin
  # and removedByAdmin into one field for simplicity and to prevent incoherent
  # states (like being both approved and rejected). Figure out if that new field
  # can be null.
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    orgId: ID!
    role: UserRole
    permissions: [UserPermission!]!
    createdAt: String!
    approvedByAdmin: Boolean
    rejectedByAdmin: Boolean
    loginMethods: [String!]!
    # Extra wrapper types here are so that we can eventually turn notifications
    # into a proper Connection in a non-breaking way if we ever need pagination.
    notifications: UserNotifications!
    readMeJWT: String
    favoriteRules: [Rule!]!
    favoriteMRTQueues: [ManualReviewQueue!]!
    interfacePreferences: UserInterfacePreferences!
    reviewableQueues(queueIds: [ID!]): [ManualReviewQueue!]!
  }

  type UserInterfacePreferences {
    moderatorSafetyMuteVideo: Boolean!
    moderatorSafetyGrayscale: Boolean!
    moderatorSafetyBlurLevel: Int!
    mrtChartConfigurations: [ManualReviewChartSettings!]!
  }

  input ModeratorSafetySettingsInput {
    moderatorSafetyMuteVideo: Boolean!
    moderatorSafetyGrayscale: Boolean!
    moderatorSafetyBlurLevel: Int!
  }

  input ManualReviewChartConfigurationsInput {
    chartConfigurations: [ManualReviewChartSettingsInput!]!
  }

  type UserNotifications {
    edges: [UserNotificationEdge!]!
  }

  type UserNotificationEdge {
    node: Notification!
  }

  enum NotificationType {
    RULE_PASS_RATE_INCREASE_ANOMALY_START
    RULE_PASS_RATE_INCREASE_ANOMALY_END
  }

  type Notification {
    id: ID!
    type: NotificationType!
    message: String!
    data: JSONObject
    readAt: DateTime
    createdAt: DateTime!
  }

  type Query {
    user(id: ID!): User
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  type ChangePasswordSuccessResponse {
    _: Boolean
  }

  type ChangePasswordError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union ChangePasswordResponse =
      ChangePasswordSuccessResponse
    | ChangePasswordError

  type Mutation {
    deleteUser(id: ID!): Boolean
    updateAccountInfo(firstName: String, lastName: String): Boolean
    changePassword(input: ChangePasswordInput!): ChangePasswordResponse!
    addFavoriteRule(ruleId: ID!): AddFavoriteRuleSuccessResponse!
    removeFavoriteRule(ruleId: ID!): RemoveFavoriteRuleSuccessResponse!
    addFavoriteMRTQueue(queueId: ID!): AddFavoriteMRTQueueSuccessResponse!
    removeFavoriteMRTQueue(queueId: ID!): RemoveFavoriteMRTQueueSuccessResponse!
    setModeratorSafetySettings(
      moderatorSafetySettings: ModeratorSafetySettingsInput!
    ): SetModeratorSafetySettingsSuccessResponse
    setMrtChartConfigurationSettings(
      mrtChartConfigurationSettings: ManualReviewChartConfigurationsInput!
    ): SetMrtChartConfigurationSettingsSuccessResponse
  }

  union AddFavoriteRuleResponse = AddFavoriteRuleSuccessResponse

  type AddFavoriteRuleSuccessResponse {
    _: Boolean
  }

  type RemoveFavoriteRuleSuccessResponse {
    _: Boolean
  }

  type SetModeratorSafetySettingsSuccessResponse {
    _: Boolean
  }

  type SetMrtChartConfigurationSettingsSuccessResponse {
    _: Boolean
  }

  type AddFavoriteMRTQueueSuccessResponse {
    _: Boolean
  }

  type RemoveFavoriteMRTQueueSuccessResponse {
    _: Boolean
  }

  union AddFavoriteRuleResponse = AddFavoriteRuleSuccessResponse
  union RemoveFavoriteRuleResponse = RemoveFavoriteRuleSuccessResponse
`;

const Query: GQLQueryResolvers = {
  async user(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { orgId } = user;
    return context.dataSources.userAPI.getGraphQLUserFromId({ id, orgId });
  },
};

const Mutation: GQLMutationResolvers = {
  async updateAccountInfo(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    await context.dataSources.userAPI.updateAccountInfo(user, params);
    return true; // TODO: return the updated user instead.
  },
  async changePassword(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }
    return context.dataSources.userAPI.changePassword(user, params.input);
  },
  async deleteUser(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.dataSources.userAPI.deleteUser({
      id: params.id,
      orgId: user.orgId,
    });
  },
  async addFavoriteRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.dataSources.userAPI.addFavoriteRule(
      user.id,
      params.ruleId,
      user.orgId,
    );
    return gqlSuccessResult({}, 'AddFavoriteRuleSuccessResponse');
  },
  async removeFavoriteRule(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.dataSources.userAPI.removeFavoriteRule(
      user.id,
      params.ruleId,
      user.orgId,
    );
    return gqlSuccessResult({}, 'RemoveFavoriteRuleSuccessResponse');
  },
  async addFavoriteMRTQueue(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.services.ManualReviewToolService.addFavoriteQueueForUser({
      userId: user.id,
      orgId: user.orgId,
      queueId: params.queueId,
    });
    return gqlSuccessResult({}, 'AddFavoriteMRTQueueSuccessResponse');
  },
  async removeFavoriteMRTQueue(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.services.ManualReviewToolService.removeFavoriteQueueForUser({
      userId: user.id,
      orgId: user.orgId,
      queueId: params.queueId,
    });
    return gqlSuccessResult({}, 'RemoveFavoriteMRTQueueSuccessResponse');
  },
  async setModeratorSafetySettings(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.services.UserManagementService.upsertUserInterfaceSettings({
      userId: user.id,
      userInterfaceSettings: {
        moderatorSafetySettings: params.moderatorSafetySettings,
      },
    });
    return gqlSuccessResult({}, 'SetModeratorSafetySettingsSuccessResponse');
  },

  async setMrtChartConfigurationSettings(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    await context.services.UserManagementService.upsertUserInterfaceSettings({
      userId: user.id,
      userInterfaceSettings: {
        mrtChartConfigurations:
          params.mrtChartConfigurationSettings.chartConfigurations.map((it) =>
            it.decisionCountSettings
              ? {
                  ...it.decisionCountSettings,
                  title: it.title,
                  metric: 'DECISIONS',
                  filterBy: {
                    ...it.decisionCountSettings.filterBy,
                    startDate: new Date(
                      it.decisionCountSettings.filterBy.startDate,
                    ),
                    endDate: new Date(
                      it.decisionCountSettings.filterBy.endDate,
                    ),
                    filteredDecisionActionType: it.decisionCountSettings
                      .filterBy.filteredDecisionActionType
                      ? it.decisionCountSettings.filterBy
                          .filteredDecisionActionType
                      : undefined,
                  },
                }
              : {
                  ...it.jobCreationCountSettings!,
                  title: it.title,
                  metric: 'JOBS',
                },
          ),
      },
    });
    return gqlSuccessResult(
      {},
      'SetMrtChartConfigurationSettingsSuccessResponse',
    );
  },
};

const User: GQLUserResolvers = {
  permissions(user) {
    return user.getPermissions();
  },
  async notifications(user, _, context) {
    const api = context.dataSources.notificationsAPI;
    const notifications = await api.getNotificationsForUser(user.id);
    return { edges: notifications.map((it) => ({ node: it })) };
  },
  async readMeJWT(user, __, { dataSources, getUser }) {
    try {
      const authedUser = getUser();
      if (!authedUser || user.id !== authedUser.id) {
        throw new ForbiddenError('Must be signed in as this user to read JWT.');
      }

      const { email, firstName, lastName, orgId } = user;
      const name = `${firstName} ${lastName}`;
      const [apiKeyRes, publicSigningKey] = await Promise.all([
        dataSources.orgAPI.getActivatedApiKeyForOrg(orgId),
        dataSources.orgAPI.getPublicSigningKeyPem(orgId),
      ]);
      const apiKey = apiKeyRes === false ? null : apiKeyRes.key;

      return jwt.sign(
        { name, email, apiKey, publicSigningKey },
        process.env.READ_ME_JWT_SECRET!,
      );
    } catch (e) {
      return null;
    }
  },
  async favoriteRules(user, _, context) {
    return context.dataSources.userAPI.getFavoriteRules(user.id, user.orgId);
  },
  async interfacePreferences(user, _, context) {
    const settings =
      await context.services.UserManagementService.getUserInterfaceSettings({
        userId: user.id,
        orgId: user.orgId,
      });
    return {
      ...settings,
      mrtChartConfigurations: settings.mrtChartConfigurations.map((it) => {
        if (!('metric' in it)) {
          throw new Error('No metric found in MRT chart configuration');
        }
        if (it.metric === 'DECISIONS') {
          return it as GQLGetDecisionCountSettings;
        } else {
          return it as GQLGetJobCreationCountSettings;
        }
      }),
    };
  },
  async favoriteMRTQueues(user, _, context) {
    return context.services.ManualReviewToolService.getFavoriteQueuesForUser({
      userId: user.id,
      orgId: user.orgId,
    });
  },
  async reviewableQueues(_, { queueIds }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    const queues =
      await context.services.ManualReviewToolService.getReviewableQueuesForUser(
        {
          invoker: {
            userId: user.id,
            permissions: user.getPermissions(),
            orgId: user.orgId,
          },
        },
      );

    if (queueIds) {
      return queues.filter((it) => queueIds.includes(it.id));
    }

    return queues;
  },
};

const resolvers = { Query, Mutation, User };

export { typeDefs, resolvers };
