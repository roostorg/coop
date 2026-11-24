/* eslint-disable max-lines */
import { isDeepStrictEqual } from 'node:util';
import { type JsonObject } from 'type-fest';

import { parseStoredParameters } from '../../services/moderationConfigService/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  type GQLActionParameter,
  type GQLActionResolvers,
  type GQLCustomActionResolvers,
  type GQLCustomMrtApiParamSpec,
  type GQLEnqueueAuthorToMrtActionResolvers,
  type GQLEnqueueToMrtActionResolvers,
  type GQLEnqueueToNcmecActionResolvers,
  type GQLMutationResolvers,
  type GQLQueryResolvers,
  type GQLUpdateActionInput,
} from '../generated.js';
import { type Context } from '../resolvers.js';
import { hasPermission, requirePermission } from '../utils/authorization.js';
import { forbiddenError, unauthenticatedError } from '../utils/errors.js';
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
    parameters: [ActionParameter!]!
    """
    Configured parameter values for this action in the context of a rule or
    strike threshold. Null when resolved outside of a rule context.
    """
    configuredParameters: JSONObject
  }

  enum ActionParameterType {
    STRING
    NUMBER
    BOOLEAN
    SELECT
    MULTISELECT
  }

  type ActionParameterOption {
    value: String!
    label: String!
  }

  input ActionParameterOptionInput {
    value: String!
    label: String!
  }

  """
  Definition of a single runtime parameter on an action. The moderator is
  prompted for a value at execution time; the value is included in the
  webhook payload under the parameter's \`name\`.
  """
  type ActionParameter {
    """
    Key under which the value is sent in the webhook payload.
    """
    name: String!
    displayName: String!
    description: String
    type: ActionParameterType!
    required: Boolean!
    options: [ActionParameterOption!]
    """
    NUMBER only: inclusive minimum.
    """
    min: Float
    """
    NUMBER only: inclusive maximum.
    """
    max: Float
    """
    STRING only: inclusive maximum length in characters.
    """
    maxLength: Int
    """
    Pre-filled value shown to the moderator. Shape matches \`type\`.
    """
    defaultValue: JSON
  }

  input ActionParameterInput {
    name: String!
    displayName: String!
    description: String
    type: ActionParameterType!
    required: Boolean!
    options: [ActionParameterOptionInput!]
    min: Float
    max: Float
    maxLength: Int
    defaultValue: JSON
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
    parameters: [ActionParameter!]!
    configuredParameters: JSONObject
    """
    Deprecated alias for \`parameters\` retained for back-compat with the
    initial MRT-only parameter implementation. New consumers should read
    \`parameters\` instead.
    """
    customMrtApiParams: [CustomMrtApiParamSpec]!
      @deprecated(reason: "Use \`parameters\` instead.")
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
    parameters: [ActionParameter!]!
    configuredParameters: JSONObject
  }

  type EnqueueToNcmecAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    applyUserStrikes: Boolean
    parameters: [ActionParameter!]!
    configuredParameters: JSONObject
  }

  type EnqueueAuthorToMrtAction implements ActionBase {
    id: ID!
    name: String!
    description: String
    orgId: String!
    penalty: UserPenaltySeverity!
    itemTypes: [ItemType!]!
    applyUserStrikes: Boolean!
    parameters: [ActionParameter!]!
    configuredParameters: JSONObject
  }

  union Action =
    | EnqueueToMrtAction
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
    parameters: [ActionParameterInput!]
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
    """
    Replace the parameter list (\`[]\` clears it). Omit to leave unchanged.
    """
    parameters: [ActionParameterInput!]
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
    | MutateActionSuccessResponse
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
    """
    Optional map of \`actionId\` -> \`{ paramName: value }\` carrying
    moderator-supplied runtime parameter values. Each map is validated against
    the action's parameter spec server-side before publish; invalid values
    reject the entire request.
    """
    parameters: JSONObject
    """
    Optional moderator-authored note explaining why this action was taken.
    Sent to the action's webhook as \`actorNote\` and persisted to the action
    execution audit log.
    """
    note: String
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

// Project the loose `JsonValue | null` stored in `actions.custom_mrt_api_params`
// to the typed `ActionParameter` shape via the service-layer
// `parseStoredParameters` (single source of truth for the projection rules).
function projectParameters(value: unknown): GQLActionParameter[] {
  return parseStoredParameters(value).map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description ?? null,
    type: p.type,
    required: p.required,
    options: p.options
      ? p.options.map((o) => ({ value: o.value, label: o.label }))
      : null,
    min: p.min ?? null,
    max: p.max ?? null,
    maxLength: p.maxLength ?? null,
    defaultValue:
      p.defaultValue === undefined
        ? null
        : (p.defaultValue as GQLActionParameter['defaultValue']),
  }));
}

// `customMrtApiParams` lives only on CustomAction in the service-layer types,
// but the underlying DB column is shared by every action type. Read it
// defensively so the GraphQL projection works for all four action types.
function readRawParameters(parent: unknown): unknown {
  if (typeof parent !== 'object' || parent === null) return null;
  return (
    (parent as { customMrtApiParams?: unknown }).customMrtApiParams ?? null
  );
}

// Populated by rule.ts resolvers when the action is resolved in a rule context.
function readConfiguredParameters(parent: unknown): JsonObject | null {
  if (typeof parent !== 'object' || parent === null) return null;
  return (
    (parent as { configuredParameters?: JsonObject }).configuredParameters ??
    null
  );
}

const CustomAction: GQLCustomActionResolvers = {
  parameters(parent) {
    return projectParameters(parent.customMrtApiParams);
  },
  configuredParameters(parent) {
    return readConfiguredParameters(parent);
  },
  customMrtApiParams(parent) {
    return Array.isArray(parent.customMrtApiParams)
      ? (parent.customMrtApiParams as readonly GQLCustomMrtApiParamSpec[])
      : [];
  },
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
  // Headers and body often carry credentials for the receiving endpoint, so
  // only users who can edit actions may read them.
  callbackUrlHeaders(action, _, context) {
    return hasPermission(context.getUser(), UserPermission.MANAGE_ORG)
      ? (action.callbackUrlHeaders as JsonObject | null)
      : null;
  },
  callbackUrlBody(action, _, context) {
    return hasPermission(context.getUser(), UserPermission.MANAGE_ORG)
      ? (action.callbackUrlBody as JsonObject | null)
      : null;
  },
};

const EnqueueAuthorToMrtAction: GQLEnqueueAuthorToMrtActionResolvers = {
  parameters(parent) {
    return projectParameters(readRawParameters(parent));
  },
  configuredParameters(parent) {
    return readConfiguredParameters(parent);
  },
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const EnqueueToMrtAction: GQLEnqueueToMrtActionResolvers = {
  parameters(parent) {
    return projectParameters(readRawParameters(parent));
  },
  configuredParameters(parent) {
    return readConfiguredParameters(parent);
  },
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
    }
    return context.services.ModerationConfigService.getItemTypesForAction({
      orgId: user.orgId,
      actionId: action.id,
    });
  },
};

const EnqueueToNcmecAction: GQLEnqueueToNcmecActionResolvers = {
  parameters(parent) {
    return projectParameters(readRawParameters(parent));
  },
  configuredParameters(parent) {
    return readConfiguredParameters(parent);
  },
  async itemTypes(action, _, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
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
      throw unauthenticatedError('User required.');
    }

    return context.dataSources.actionAPI.getGraphQLActionFromId({
      id,
      orgId: user.orgId,
    });
  },
};

async function changesCallback(
  context: Context,
  orgId: string,
  input: GQLUpdateActionInput,
) {
  // A null callbackUrl leaves it unchanged; null headers or body clear them.
  const changing = [
    ...(input.callbackUrl != null ? (['callbackUrl'] as const) : []),
    ...(['callbackUrlHeaders', 'callbackUrlBody'] as const).filter(
      (field) => input[field] !== undefined,
    ),
  ];
  if (changing.length === 0) {
    return false;
  }
  const stored = (
    await context.services.ModerationConfigService.getActions({
      orgId,
      ids: [input.id],
      readFromReplica: false,
    })
  ).at(0);
  if (stored?.actionType !== 'CUSTOM_ACTION') {
    return true;
  }
  return changing.some(
    (field) => !isDeepStrictEqual(input[field] ?? null, stored[field] ?? null),
  );
}

const Mutation: GQLMutationResolvers = {
  async createAction(_, params, context) {
    const user = requirePermission(
      context.getUser(),
      UserPermission.MUTATE_LIVE_RULES,
    );
    try {
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
    const user = requirePermission(
      context.getUser(),
      UserPermission.MUTATE_LIVE_RULES,
    );
    const { orgId } = user;
    // The webhook carries the stored headers and body, so only users who can
    // read them may change where it goes or what it sends.
    if (
      !hasPermission(user, UserPermission.MANAGE_ORG) &&
      (await changesCallback(context, orgId, params.input))
    ) {
      throw forbiddenError(
        'MANAGE_ORG permission required to change an action callback.',
      );
    }
    try {
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
    const { orgId } = requirePermission(
      context.getUser(),
      UserPermission.MUTATE_LIVE_RULES,
    );
    return context.dataSources.actionAPI.deleteAction(orgId, params.id);
  },
  async bulkExecuteActions(_, params, context) {
    const { orgId, id, email } = requirePermission(
      context.getUser(),
      UserPermission.MANUALLY_ACTION_CONTENT,
    );

    const actionResults =
      await context.dataSources.actionAPI.bulkExecuteActions({
        itemIds: params.input.itemIds,
        actionIds: params.input.actionIds,
        itemTypeId: params.input.itemTypeId,
        policyIds: params.input.policyIds,
        orgId,
        actorId: id,
        actorEmail: email,
        // GraphQL `JSONObject` arrives as a plain object; the datasource
        // narrows + validates per-action against each spec.
        actionIdToParameters: (params.input.parameters ?? null) as Record<
          string,
          Record<string, unknown>
        > | null,
        actorNote: params.input.note ?? null,
      });

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
