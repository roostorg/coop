import { AuthenticationError } from 'apollo-server-express';

import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  type GQLActionResolvers,
  type GQLCustomActionResolvers,
  type GQLEnqueueAuthorToMrtActionResolvers,
  type GQLEnqueueToMrtActionResolvers,
  type GQLEnqueueToNcmecActionResolvers,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  interface ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    applyUserStrikes: Boolean
    itemTypes: [ItemType!]!
  }

  type CustomAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    callbackUrl: String!
    callbackUrlHeaders: JSONObject
    callbackUrlBody: JSONObject
    applyUserStrikes: Boolean
    customMrtApiParams: [CustomMrtApiParamSpec]!
  }

  type CustomMrtApiParamSpec {
    name: String!
    displayName: String!
    type: String!
  }

  type EnqueueToMrtAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    applyUserStrikes: Boolean
  }

  type EnqueueToNcmecAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    applyUserStrikes: Boolean
  }

  type EnqueueAuthorToMrtAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    applyUserStrikes: Boolean!
  }

  union Action =
      EnqueueToMrtAction
    | EnqueueToNcmecAction
    | CustomAction
    | EnqueueAuthorToMrtAction

  input CreateActionInput {
    name: String!
    description: String
    itemTypeIds: [ID!]!
    callbackUrl: String!
    callbackUrlHeaders: JSONObject
    callbackUrlBody: JSONObject
    applyUserStrikes: Boolean
  }

  input UpdateActionInput {
    id: ID!
    name: String
    description: String
    itemTypeIds: [ID!]
    callbackUrl: String
    callbackUrlHeaders: JSONObject
    callbackUrlBody: JSONObject
    applyUserStrikes: Boolean
  }

  type ActionNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union MutateActionResponse =
      MutateActionSuccessResponse
    | ActionNameExistsError

  type MutateActionSuccessResponse {
    data: CustomAction!
  }

  input ExecuteBulkActionsInput {
    itemTypeId: String!
    itemIds: [String!]!
    actionIds: [String!]!
    policyIds: [String!]!
    # this should be a mapping of actionId to { paramName: value } pairs
    actionIdsToMrtApiParamDecisionPayload: JSONObject
  }

  input ExecuteBulkActionInput {
    itemIds: [String!]!
    actionIds: [String!]!
    itemTypeId: String!
    policyIds: [String!]!
  }

  type ExecuteActionResponse {
    itemId: String!
    actionId: String!
    success: Boolean!
  }

  type ExecuteBulkActionResponse {
    results: [ExecuteActionResponse!]!
  }

  type Query {
    action(id: ID!): Action
  }

  type Mutation {
    createAction(input: CreateActionInput!): MutateActionResponse!
    updateAction(input: UpdateActionInput!): MutateActionResponse!
    deleteAction(id: ID!): Boolean
    bulkExecuteActions(
      input: ExecuteBulkActionInput!
    ): ExecuteBulkActionResponse!
  }
`;

const Action: GQLActionResolvers = {
  __resolveType(it) {
    switch (it.actionType) {
      case 'CUSTOM_ACTION': {
        return 'CustomAction';
      }
      case 'ENQUEUE_TO_MRT': {
        return 'EnqueueToMrtAction';
      }
      case 'ENQUEUE_TO_NCMEC': {
        return 'EnqueueToNcmecAction';
      }
      case 'ENQUEUE_AUTHOR_TO_MRT': {
        return 'EnqueueAuthorToMrtAction';
      }
      default:
        assertUnreachable(it);
    }
  },
};

const CustomAction: GQLCustomActionResolvers = {
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const EnqueueAuthorToMrtAction: GQLEnqueueAuthorToMrtActionResolvers = {
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const EnqueueToMrtAction: GQLEnqueueToMrtActionResolvers = {
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const EnqueueToNcmecAction: GQLEnqueueToNcmecActionResolvers = {
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const Query: GQLQueryResolvers = {
  async action(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    return context.dataSources.actionAPI.getGraphQLActionFromId({
      id,
      orgId: user.orgId,
    });
  },
};

const Mutation: GQLMutationResolvers = {
  async createAction(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('User required.');
      }
      const action = await context.dataSources.actionAPI.createAction(
        params.input,
        user.orgId,
      );
      return gqlSuccessResult({ data: action }, 'MutateActionSuccessResponse');
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ActionNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async updateAction(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('User required.');
      }
      const { orgId } = user;
      const action = await context.dataSources.actionAPI.updateAction(
        params.input,
        orgId,
      );
      return gqlSuccessResult({ data: action }, 'MutateActionSuccessResponse');
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'ActionNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async deleteAction(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }
    const { orgId } = user;
    return context.dataSources.actionAPI.deleteAction(orgId, params.id);
  },
  async bulkExecuteActions(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('User required.');
    }

    const { orgId, id, email } = user;

    const actionResults =
      await context.dataSources.actionAPI.bulkExecuteActions(
        params.input.itemIds,
        params.input.actionIds,
        params.input.itemTypeId,
        params.input.policyIds,
        orgId,
        id,
        email,
      );

    return {
      results: actionResults.flat().map((actionResult) => ({
        actionId: actionResult.actionId,
        itemId: actionResult.targetItem.itemId,
        success: actionResult.success,
      })),
    };
  },
};

const resolvers = {
  Action,
  CustomAction,
  EnqueueToMrtAction,
  EnqueueToNcmecAction,
  EnqueueAuthorToMrtAction,
  Query,
  Mutation,
};

export { typeDefs, resolvers };
