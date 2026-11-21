/* eslint-disable max-lines -- action transaction and error definitions stay colocated */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { type JsonObject, type JsonValue, type Writable } from 'type-fest';
import { uid } from 'uid';

import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
import {
  CoopError,
  ErrorType,
  makeNotFoundError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { assertUnreachable, removeUndefinedKeys } from '../../../utils/misc.js';
import { type Action, type ActionType, type CustomAction } from '../index.js';
import { type ItemTypeKind } from '../types/itemTypes.js';
import { type UserPenaltySeverity } from '../types/shared.js';
import {
  serializeParameters,
  validateActionParameters,
  type RawActionParameterInput,
} from './actionParametersValidation.js';
import { runInTransaction } from './drizzleTx.js';

function assertCustomAction(action: Action): asserts action is CustomAction {
  if (action.actionType !== 'CUSTOM_ACTION') {
    throw new Error(`Expected CUSTOM_ACTION but received ${action.actionType}`);
  }
}

// Seeded once per org by upsertBuiltInActions; not creatable/editable via the
// CRUD APIs, which are scoped to action_type='CUSTOM_ACTION'.
export const BUILT_IN_ACTIONS = [
  {
    actionType: 'ENQUEUE_TO_MRT',
    name: 'Enqueue Item to Manual Review',
    description:
      'Sends the matched item directly to a manual review queue, routed by the org\u2019s MRT routing rules.',
    appliesToAllItemsOfKind: ['CONTENT', 'USER', 'THREAD'] as const,
  },
  {
    actionType: 'ENQUEUE_AUTHOR_TO_MRT',
    name: 'Enqueue Author for Manual Review',
    description:
      'Sends the author of the matched content to a manual review queue, with the matched item attached as context.',
    appliesToAllItemsOfKind: ['CONTENT'] as const,
  },
  {
    actionType: 'ENQUEUE_TO_NCMEC',
    name: 'Enqueue for NCMEC Review',
    description:
      'Sends the user associated with the matched item to the NCMEC review flow, gathering their media for reporting.',
    appliesToAllItemsOfKind: ['CONTENT', 'USER'] as const,
  },
] as const satisfies readonly {
  actionType: Exclude<Action['actionType'], 'CUSTOM_ACTION'>;
  name: string;
  description: string;
  appliesToAllItemsOfKind: readonly ItemTypeKind[];
}[];

const actions = schema.actions;
const actionsAndItemTypes = schema.actionsAndItemTypes;

const actionDbSelection = {
  id: actions.id,
  name: actions.name,
  description: actions.description,
  callbackUrl: actions.callbackUrl,
  callbackUrlHeaders: actions.callbackUrlHeaders,
  callbackUrlBody: actions.callbackUrlBody,
  orgId: actions.orgId,
  penalty: actions.penalty,
  actionType: actions.actionType,
  appliesToAllItemsOfKind: actions.appliesToAllItemsOfKind,
  applyUserStrikes: actions.applyUserStrikes,
  customMrtApiParams: actions.customMrtApiParams,
};

// The db doesn't correlate action_type with callback_url nullability in a way
// the model can express, so rows are narrowed to this shape.
type ActionDbResult = {
  id: string;
  name: string;
  description: string | null;
  callbackUrlHeaders: JsonObject | null;
  callbackUrlBody: JsonObject | null;
  orgId: string;
  penalty: UserPenaltySeverity;
  appliesToAllItemsOfKind: ItemTypeKind[];
  applyUserStrikes: boolean;
  customMrtApiParams: JsonValue[] | null;
} & (
  | { actionType: 'CUSTOM_ACTION'; callbackUrl: string }
  | {
      actionType: Exclude<ActionType, 'CUSTOM_ACTION'>;
      callbackUrl: null;
    }
);

export default class ActionOperations {
  constructor(
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
  ) {}

  async createAction(
    orgId: string,
    input: {
      name: string;
      description: string | null;
      // TODO: support other types? Need to figure out relationship between
      // activating various org settings (e.g., to enable MRT or NCMEC reporting)
      // and this moderationConfigService.
      type: 'CUSTOM_ACTION';
      callbackUrl: string;
      callbackUrlHeaders: JsonObject | null;
      callbackUrlBody: JsonObject | null;
      applyUserStrikes?: boolean;
      itemTypeIds?: readonly string[];
      // AJV narrows this to `readonly ActionParameter[]` and rejects nulls /
      // unknown fields; the GraphQL input shape is wider (nullable optionals)
      // so we accept arbitrary property bags here.
      parameters?: readonly RawActionParameterInput[] | null;
    },
  ): Promise<CustomAction> {
    const parameters = validateActionParameters(input.parameters ?? null);

    return runInTransaction(this.pgQuery, async (trx) => {
      try {
        if (input.itemTypeIds !== undefined) {
          await this.#validateItemTypeIds(trx, orgId, input.itemTypeIds);
        }
        const [actionRow] = (await trx
          .insert(actions)
          .values({
            id: uid(),
            name: input.name,
            description: input.description,
            orgId,
            actionType: input.type,
            callbackUrl: input.callbackUrl,
            callbackUrlHeaders: input.callbackUrlHeaders,
            callbackUrlBody: input.callbackUrlBody,
            penalty: 'NONE',
            applyUserStrikes: input.applyUserStrikes ?? false,
            customMrtApiParams: serializeParameters(parameters),
            updatedAt: new Date(),
          })
          .returning(actionDbSelection)) as ActionDbResult[];

        if (input.itemTypeIds !== undefined && input.itemTypeIds.length > 0) {
          await trx.insert(actionsAndItemTypes).values(
            input.itemTypeIds.map((itemTypeId) => ({
              actionId: actionRow.id,
              itemTypeId,
            })),
          );
        }

        const action = this.#dbResultToAction(actionRow);
        assertCustomAction(action);
        return action;
      } catch (e: unknown) {
        if (isUniqueViolationError(e)) {
          throw makeActionNameExistsError({ shouldErrorSpan: true });
        }
        throw e;
      }
    });
  }

  // Idempotent: existing built-ins are detected by (org_id, action_type).
  async upsertBuiltInActions(orgId: string): Promise<readonly Action[]> {
    return runInTransaction(this.pgQuery, async (trx) => {
      const existingByType = new Set(
        (
          await trx
            .select({ actionType: actions.actionType })
            .from(actions)
            .where(
              and(
                eq(actions.orgId, orgId),
                ne(actions.actionType, 'CUSTOM_ACTION'),
              ),
            )
        ).map((row) => row.actionType),
      );

      const toInsert = BUILT_IN_ACTIONS.filter(
        (b) => !existingByType.has(b.actionType),
      ).map((b) => ({
        id: uid(),
        name: b.name,
        description: b.description,
        orgId,
        actionType: b.actionType,
        callbackUrl: null,
        callbackUrlHeaders: null,
        callbackUrlBody: null,
        penalty: 'NONE' as const,
        applyUserStrikes: false,
        appliesToAllItemsOfKind: [...b.appliesToAllItemsOfKind],
        updatedAt: new Date(),
      }));

      if (toInsert.length > 0) {
        await trx.insert(actions).values(toInsert).onConflictDoNothing();
      }

      const refreshed = (await trx
        .select(actionDbSelection)
        .from(actions)
        .where(
          and(
            eq(actions.orgId, orgId),
            ne(actions.actionType, 'CUSTOM_ACTION'),
          ),
        )) as ActionDbResult[];

      return refreshed.map((row) => this.#dbResultToAction(row));
    });
  }

  async updateCustomAction(opts: {
    orgId: string;
    actionId: string;
    patch: {
      name?: string;
      description?: string | null;
      callbackUrl?: string;
      callbackUrlHeaders?: JsonObject | null;
      callbackUrlBody?: JsonObject | null;
      applyUserStrikes?: boolean;
      // `undefined` = leave unchanged. Pass `[]` to clear all parameters.
      parameters?: readonly RawActionParameterInput[] | null;
    };
    itemTypeIds?: readonly string[] | undefined;
  }): Promise<CustomAction> {
    const { orgId, actionId, patch, itemTypeIds } = opts;
    return runInTransaction(this.pgQuery, async (trx) => {
      const [existing] = (await trx
        .select(actionDbSelection)
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.orgId, orgId),
            eq(actions.actionType, 'CUSTOM_ACTION'),
          ),
        )
        .limit(1)) as (ActionDbResult | undefined)[];

      if (existing == null) {
        throw makeNotFoundError('Action not found', { shouldErrorSpan: true });
      }

      const validatedParameters =
        patch.parameters === undefined
          ? undefined
          : validateActionParameters(patch.parameters);

      if (itemTypeIds !== undefined) {
        await this.#validateItemTypeIds(trx, orgId, itemTypeIds);
      }

      const setPayload = removeUndefinedKeys({
        name: patch.name,
        description: patch.description,
        callbackUrl: patch.callbackUrl,
        callbackUrlHeaders: patch.callbackUrlHeaders,
        callbackUrlBody: patch.callbackUrlBody,
        applyUserStrikes: patch.applyUserStrikes,
        customMrtApiParams:
          validatedParameters === undefined
            ? undefined
            : serializeParameters(validatedParameters),
      });
      const hasUserFields = Object.keys(setPayload).length > 0;
      const touchesJunction = itemTypeIds !== undefined;

      if (!hasUserFields && !touchesJunction) {
        const action = this.#dbResultToAction(existing);
        assertCustomAction(action);
        return action;
      }

      try {
        if (hasUserFields) {
          await trx
            .update(actions)
            .set({ ...setPayload, updatedAt: new Date() })
            .where(and(eq(actions.id, actionId), eq(actions.orgId, orgId)));
        }

        if (itemTypeIds !== undefined) {
          await trx
            .delete(actionsAndItemTypes)
            .where(eq(actionsAndItemTypes.actionId, actionId));
          if (itemTypeIds.length > 0) {
            await trx
              .insert(actionsAndItemTypes)
              .values(
                itemTypeIds.map((itemTypeId) => ({ actionId, itemTypeId })),
              );
          }
        }

        const [refreshed] = (await trx
          .select(actionDbSelection)
          .from(actions)
          .where(and(eq(actions.id, actionId), eq(actions.orgId, orgId)))
          .limit(1)) as (ActionDbResult | undefined)[];
        if (refreshed === undefined) {
          throw makeNotFoundError('Action not found', {
            shouldErrorSpan: true,
          });
        }

        const action = this.#dbResultToAction(refreshed);
        assertCustomAction(action);
        return action;
      } catch (e: unknown) {
        if (isUniqueViolationError(e)) {
          throw makeActionNameExistsError({ shouldErrorSpan: true });
        }
        throw e;
      }
    });
  }

  async deleteCustomAction(opts: { orgId: string; actionId: string }) {
    const { orgId, actionId } = opts;
    return runInTransaction(this.pgQuery, async (trx) => {
      const [row] = await trx
        .select({ id: actions.id })
        .from(actions)
        .where(
          and(
            eq(actions.id, actionId),
            eq(actions.orgId, orgId),
            eq(actions.actionType, 'CUSTOM_ACTION'),
          ),
        )
        .limit(1);

      if (row == null) {
        return false;
      }

      await trx
        .delete(schema.rulesAndActions)
        .where(eq(schema.rulesAndActions.actionId, actionId));
      await trx
        .delete(actionsAndItemTypes)
        .where(eq(actionsAndItemTypes.actionId, actionId));
      await trx
        .delete(actions)
        .where(and(eq(actions.id, actionId), eq(actions.orgId, orgId)));

      return true;
    });
  }

  async getActionsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    itemTypeKind: ItemTypeKind;
    readFromReplica?: boolean;
  }) {
    const { orgId, itemTypeId, itemTypeKind, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);

    const [viaJunction, viaAppliesAll] = (await Promise.all([
      pgQuery
        .select(actionDbSelection)
        .from(actionsAndItemTypes)
        .innerJoin(actions, eq(actions.id, actionsAndItemTypes.actionId))
        .where(
          and(
            eq(actionsAndItemTypes.itemTypeId, itemTypeId),
            eq(actions.orgId, orgId),
          ),
        ),
      pgQuery
        .select(actionDbSelection)
        .from(actions)
        .where(
          and(
            eq(actions.orgId, orgId),
            sql`${itemTypeKind}::text = ANY(${actions.appliesToAllItemsOfKind}::text[])`,
          ),
        ),
    ])) as [ActionDbResult[], ActionDbResult[]];

    const byId = new Map<string, ActionDbResult>();
    for (const row of [...viaJunction, ...viaAppliesAll]) {
      byId.set(row.id, row);
    }
    return [...byId.values()].map((it) => this.#dbResultToAction(it));
  }

  async getActions(opts: {
    orgId: string;
    ids?: readonly string[];
    readFromReplica?: boolean;
  }) {
    const { ids, orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const results = (await pgQuery
      .select(actionDbSelection)
      .from(actions)
      .where(
        and(
          eq(actions.orgId, orgId),
          ids !== undefined ? inArray(actions.id, [...ids]) : undefined,
        ),
      )) as ActionDbResult[];

    return results.map((it) => this.#dbResultToAction(it));
  }

  // Returns each action attached to a rule paired with the parameter values
  // configured for it. Powers proactive rule execution and pre-fills the rule editor.
  async getActionsForRuleId(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<readonly { action: Action; parameters: JsonObject }[]> {
    const { orgId, ruleId, readFromReplica } = opts;
    const raa = schema.rulesAndActions;
    const results = (await this.#getPgQuery(readFromReplica)
      .select({ ...actionDbSelection, action_parameters: raa.actionParameters })
      .from(raa)
      .innerJoin(actions, eq(actions.id, raa.actionId))
      .where(
        and(eq(raa.ruleId, ruleId), eq(actions.orgId, orgId)),
      )) as (ActionDbResult & {
      action_parameters: JsonObject | null;
    })[];
    return results.map((it) => ({
      action: this.#dbResultToAction(it),
      parameters: it.action_parameters ?? {},
    }));
  }

  private static customMrtApiParamsFromDb(
    value: JsonValue[] | null,
  ): JsonValue | null {
    if (value == null || value.length === 0) {
      return null;
    }
    return value;
  }

  #dbResultToAction(it: ActionDbResult) {
    return {
      id: it.id,
      name: it.name,
      description: it.description,
      orgId: it.orgId,
      applyUserStrikes: it.applyUserStrikes,
      penalty: it.penalty,
      ...(() => {
        switch (it.actionType) {
          case 'CUSTOM_ACTION':
            return {
              actionType: it.actionType,
              callbackUrl: it.callbackUrl,
              callbackUrlBody: it.callbackUrlBody,
              callbackUrlHeaders: it.callbackUrlHeaders,
              customMrtApiParams: ActionOperations.customMrtApiParamsFromDb(
                it.customMrtApiParams,
              ),
            };
          case 'ENQUEUE_TO_MRT':
          case 'ENQUEUE_TO_NCMEC':
          case 'ENQUEUE_AUTHOR_TO_MRT':
            return { actionType: it.actionType };
          default:
            assertUnreachable(it);
        }
      })(),
    } satisfies Writable<Action> as Action;
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }

  async #validateItemTypeIds(
    trx: CoopDbOrTx,
    orgId: string,
    itemTypeIds: readonly string[],
  ) {
    const uniqueIds = new Set(itemTypeIds);
    if (uniqueIds.size !== itemTypeIds.length) {
      throw makeInvalidActionItemTypeIdsError({ shouldErrorSpan: true });
    }
    if (itemTypeIds.length === 0) return;

    const matchingRows = await trx
      .select({ id: schema.itemTypes.id })
      .from(schema.itemTypes)
      .where(
        and(
          eq(schema.itemTypes.orgId, orgId),
          inArray(schema.itemTypes.id, [...itemTypeIds]),
        ),
      );
    if (matchingRows.length !== itemTypeIds.length) {
      throw makeInvalidActionItemTypeIdsError({ shouldErrorSpan: true });
    }
  }
}

export type ActionErrorType =
  'ActionNameExistsError' | 'InvalidActionItemTypeIdsError';

export const makeActionNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'An action with this name already exists',
    name: 'ActionNameExistsError',
    ...data,
  });

export const makeInvalidActionItemTypeIdsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 400,
    type: [ErrorType.InvalidUserInput],
    title: 'Invalid action item type IDs',
    detail: 'One or more item type IDs are invalid',
    name: 'InvalidActionItemTypeIdsError',
    ...data,
  });
