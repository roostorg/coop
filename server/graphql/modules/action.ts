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
} from '../generated.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';
import { unauthenticatedError } from '../utils/errors.js';
import { ACTION_PARAMETER_TYPES } from '../../services/moderationConfigService/index.js';

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
    """Key under which the value is sent in the webhook payload."""
    name: String!
    displayName: String!
    description: String
    type: ActionParameterType!
    required: Boolean!
    options: [ActionParameterOption!]
    """NUMBER only: inclusive minimum."""
    min: Float
    """NUMBER only: inclusive maximum."""
    max: Float
    """STRING only: inclusive maximum length in characters."""
    maxLength: Int
    """Pre-filled value shown to the moderator. Shape matches \`type\`."""
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

// Project the loose `JsonValue | null` stored in `actions.custom_mrt_api_params`
// to the typed `ActionParameter` shape. Silently drops malformed entries so
// legacy rows (written before parameter authoring landed) don't crash reads.
function projectParameters(value: unknown): GQLActionParameter[] {
  if (!Array.isArray(value)) return [];
  const allowedTypes = ACTION_PARAMETER_TYPES as readonly string[];
  const out: GQLActionParameter[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const obj = raw as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name : null;
    const displayName = typeof obj.displayName === 'string' ? obj.displayName : null;
    const typeRaw = typeof obj.type === 'string' ? obj.type : null;
    if (name === null || displayName === null || typeRaw === null) continue;
    if (!allowedTypes.includes(typeRaw)) continue;
    out.push({
      name,
      displayName,
      description: typeof obj.description === 'string' ? obj.description : null,
      type: typeRaw as GQLActionParameter['type'],
      required: obj.required === true,
      options: Array.isArray(obj.options)
        ? obj.options.flatMap((opt) => {
            if (typeof opt !== 'object' || opt === null) return [];
            const o = opt as Record<string, unknown>;
            return typeof o.value === 'string' && typeof o.label === 'string'
              ? [{ value: o.value, label: o.label }]
              : [];
          })
        : null,
      min: typeof obj.min === 'number' ? obj.min : null,
      max: typeof obj.max === 'number' ? obj.max : null,
      maxLength: typeof obj.maxLength === 'number' ? obj.maxLength : null,
      defaultValue: 'defaultValue' in obj ? (obj.defaultValue as GQLActionParameter['defaultValue']) : null,
    });
  }
  return out;
}

// `customMrtApiParams` lives only on CustomAction in the service-layer types,
// but the underlying DB column is shared by every action type. Read it
// defensively so the GraphQL projection works for all four action types.
function readRawParameters(parent: unknown): unknown {
  if (typeof parent !== 'object' || parent === null) return null;
  return (parent as { customMrtApiParams?: unknown }).customMrtApiParams ?? null;
}

const CustomAction: GQLCustomActionResolvers = {
  parameters(parent) {
    return projectParameters(parent.customMrtApiParams);
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
};

const EnqueueAuthorToMrtAction: GQLEnqueueAuthorToMrtActionResolvers = {
  parameters(parent) {
    return projectParameters(readRawParameters(parent));
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

const Mutation: GQLMutationResolvers = {
  async createAction(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw unauthenticatedError('User required.');
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
        throw unauthenticatedError('User required.');
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
      throw unauthenticatedError('User required.');
    }
    const { orgId } = user;
    return context.dataSources.actionAPI.deleteAction(orgId, params.id);
  },
  async bulkExecuteActions(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw unauthenticatedError('User required.');
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
