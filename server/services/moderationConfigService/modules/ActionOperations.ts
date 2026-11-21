/* eslint-disable max-lines -- action transaction and error definitions stay colocated */
import { type JsonObject, type JsonValue, type Writable } from 'type-fest';
import { In, type EntityManager, type FindOptionsWhere } from 'typeorm';
import {
  type QueryDeepPartialEntity,
  type QueryPartialEntity,
} from 'typeorm/query-builder/QueryPartialEntity.js';
import { uid } from 'uid';

import {
  managerOf,
  transactionWithRetry,
  type TypeormDb,
} from '../../../storage/typeorm/db.js';
import {
  Actions,
  ActionsAndItemTypes,
  ItemTypes,
  RulesAndActions,
} from '../../../storage/typeorm/entities/index.js';
import {
  CoopError,
  ErrorType,
  makeNotFoundError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { assertUnreachable, removeUndefinedKeys } from '../../../utils/misc.js';
import { type Action, type CustomAction } from '../index.js';
import { type ItemTypeKind } from '../types/itemTypes.js';
import {
  serializeParameters,
  validateActionParameters,
  type RawActionParameterInput,
} from './actionParametersValidation.js';

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

const actionSelect = {
  id: true,
  name: true,
  description: true,
  callback_url: true,
  callback_url_headers: true,
  callback_url_body: true,
  org_id: true,
  penalty: true,
  action_type: true,
  applies_to_all_items_of_kind: true,
  apply_user_strikes: true,
  custom_mrt_api_params: true,
} as const;

const actionReturning = Object.keys(actionSelect);

type ActionRow = Pick<Actions, keyof typeof actionSelect>;

// TypeORM JSON.stringify()s every json/jsonb value, which turns a jsonb[]
// value into a single JSON array that Postgres rejects as a malformed array
// literal. Binding the JS array as a raw parameter lets `pg` serialize it as a
// Postgres array of JSON values instead.
const CUSTOM_MRT_API_PARAMS = () => ':customMrtApiParams';

export default class ActionOperations {
  constructor(
    private readonly pgQuery: TypeormDb,
    private readonly pgQueryReplica: TypeormDb,
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

    return transactionWithRetry(this.pgQuery, {}, async (manager) => {
      try {
        if (input.itemTypeIds !== undefined) {
          await this.#validateItemTypeIds(manager, orgId, input.itemTypeIds);
        }
        // QueryDeepPartialEntity recurses into JSON columns and rejects null
        // leaves (JsonObject allows them), so writes are typed shallowly.
        const values: QueryPartialEntity<Actions> = {
          id: uid(),
          name: input.name,
          description: input.description,
          org_id: orgId,
          action_type: input.type,
          callback_url: input.callbackUrl,
          callback_url_headers: input.callbackUrlHeaders,
          callback_url_body: input.callbackUrlBody,
          penalty: 'NONE',
          apply_user_strikes: input.applyUserStrikes ?? false,
          custom_mrt_api_params: CUSTOM_MRT_API_PARAMS,
          updated_at: new Date(),
        };
        const inserted = await manager
          .createQueryBuilder()
          .insert()
          .into(Actions)
          .values(values as QueryDeepPartialEntity<Actions>)
          .setParameter('customMrtApiParams', serializeParameters(parameters))
          .returning(actionReturning)
          .execute();
        const actionRow = (inserted.raw as ActionRow[])[0];

        if (input.itemTypeIds !== undefined && input.itemTypeIds.length > 0) {
          await manager.insert(
            ActionsAndItemTypes,
            input.itemTypeIds.map((item_type_id) => ({
              action_id: actionRow.id,
              item_type_id,
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
    return transactionWithRetry(this.pgQuery, {}, async (manager) => {
      const existingByType = new Set(
        (
          await manager
            .createQueryBuilder(Actions, 'a')
            .select('a.action_type', 'actionType')
            .where("a.org_id = :orgId AND a.action_type != 'CUSTOM_ACTION'", {
              orgId,
            })
            .getRawMany<{ actionType: Action['actionType'] }>()
        ).map((row) => row.actionType),
      );

      const toInsert = BUILT_IN_ACTIONS.filter(
        (b) => !existingByType.has(b.actionType),
      ).map((b) => ({
        id: uid(),
        name: b.name,
        description: b.description,
        org_id: orgId,
        action_type: b.actionType,
        callback_url: null,
        callback_url_headers: null,
        callback_url_body: null,
        penalty: 'NONE' as const,
        apply_user_strikes: false,
        applies_to_all_items_of_kind: [...b.appliesToAllItemsOfKind],
        updated_at: new Date(),
      }));

      if (toInsert.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(Actions)
          .values(toInsert)
          .orIgnore()
          .execute();
      }

      const refreshed = await manager
        .createQueryBuilder(Actions, 'a')
        .select(Object.keys(actionSelect).map((col) => `a.${col}`))
        .where("a.org_id = :orgId AND a.action_type != 'CUSTOM_ACTION'", {
          orgId,
        })
        .getMany();

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
    return transactionWithRetry(this.pgQuery, {}, async (manager) => {
      const existing = await manager.findOne(Actions, {
        select: actionSelect,
        where: { id: actionId, org_id: orgId, action_type: 'CUSTOM_ACTION' },
      });

      if (existing == null) {
        throw makeNotFoundError('Action not found', { shouldErrorSpan: true });
      }

      const validatedParameters =
        patch.parameters === undefined
          ? undefined
          : validateActionParameters(patch.parameters);

      if (itemTypeIds !== undefined) {
        await this.#validateItemTypeIds(manager, orgId, itemTypeIds);
      }

      const setPayload = removeUndefinedKeys({
        name: patch.name,
        description: patch.description,
        callback_url: patch.callbackUrl,
        callback_url_headers: patch.callbackUrlHeaders,
        callback_url_body: patch.callbackUrlBody,
        apply_user_strikes: patch.applyUserStrikes,
        custom_mrt_api_params:
          validatedParameters === undefined ? undefined : CUSTOM_MRT_API_PARAMS,
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
          const update = manager
            .createQueryBuilder()
            .update(Actions)
            .set({
              ...setPayload,
              updated_at: new Date(),
            } satisfies QueryPartialEntity<Actions> as QueryDeepPartialEntity<Actions>)
            .where('id = :actionId AND org_id = :orgId', { actionId, orgId });
          if (validatedParameters !== undefined) {
            update.setParameter(
              'customMrtApiParams',
              serializeParameters(validatedParameters),
            );
          }
          await update.execute();
        }

        if (itemTypeIds !== undefined) {
          await manager.delete(ActionsAndItemTypes, { action_id: actionId });
          if (itemTypeIds.length > 0) {
            await manager.insert(
              ActionsAndItemTypes,
              itemTypeIds.map((item_type_id) => ({
                action_id: actionId,
                item_type_id,
              })),
            );
          }
        }

        const refreshed = await manager.findOneOrFail(Actions, {
          select: actionSelect,
          where: { id: actionId, org_id: orgId },
        });

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
    return transactionWithRetry(this.pgQuery, {}, async (manager) => {
      const row = await manager.findOne(Actions, {
        select: { id: true },
        where: { id: actionId, org_id: orgId, action_type: 'CUSTOM_ACTION' },
      });

      if (row == null) {
        return false;
      }

      await manager.delete(RulesAndActions, { action_id: actionId });
      await manager.delete(ActionsAndItemTypes, { action_id: actionId });
      await manager.delete(Actions, { id: actionId, org_id: orgId });

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
    const manager = await this.#getManager(readFromReplica);
    const selection = Object.keys(actionSelect).map((col) => `a.${col}`);

    const [junctionRows, appliesAllRows] = await Promise.all([
      manager
        .createQueryBuilder(Actions, 'a')
        .select(selection)
        .innerJoin(ActionsAndItemTypes, 'ait', 'ait.action_id = a.id')
        .where('ait.item_type_id = :itemTypeId AND a.org_id = :orgId', {
          itemTypeId,
          orgId,
        })
        .getMany(),
      manager
        .createQueryBuilder(Actions, 'a')
        .select(selection)
        .where('a.org_id = :orgId', { orgId })
        .andWhere(
          'CAST(:itemTypeKind AS text) = ANY(a.applies_to_all_items_of_kind::text[])',
          { itemTypeKind },
        )
        .getMany(),
    ]);

    const byId = new Map<string, ActionRow>();
    for (const row of [...junctionRows, ...appliesAllRows]) {
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
    const manager = await this.#getManager(readFromReplica);
    const where: FindOptionsWhere<Actions> = { org_id: orgId };
    if (ids !== undefined) {
      where.id = In([...ids]);
    }
    const results = await manager.find(Actions, {
      select: actionSelect,
      where,
    });

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
    const manager = await this.#getManager(readFromReplica);
    const results = await manager.find(RulesAndActions, {
      select: {
        rule_id: true,
        action_id: true,
        action_parameters: true,
        action: actionSelect,
      },
      relations: { action: true },
      where: { rule_id: ruleId, action: { org_id: orgId } },
    });
    return results.map((it) => ({
      // The FK is NOT NULL, so the inner join always hydrates the action.
      action: this.#dbResultToAction(it.action!),
      parameters: (it.action_parameters as JsonObject | null) ?? {},
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

  #dbResultToAction(it: ActionRow) {
    const base = {
      id: it.id,
      name: it.name,
      description: it.description,
      orgId: it.org_id,
      applyUserStrikes: it.apply_user_strikes,
      penalty: it.penalty,
    };
    // The DB's callback_url_check constraint guarantees CUSTOM_ACTION rows
    // carry a callback URL; the entity type can't express that correlation.
    switch (it.action_type) {
      case 'CUSTOM_ACTION':
        return {
          ...base,
          actionType: it.action_type,
          callbackUrl: it.callback_url!,
          callbackUrlBody: it.callback_url_body as JsonObject | null,
          callbackUrlHeaders: it.callback_url_headers as JsonObject | null,
          customMrtApiParams: ActionOperations.customMrtApiParamsFromDb(
            it.custom_mrt_api_params as JsonValue[] | null,
          ),
        } satisfies Writable<Action> as Action;
      case 'ENQUEUE_TO_MRT':
      case 'ENQUEUE_TO_NCMEC':
      case 'ENQUEUE_AUTHOR_TO_MRT':
        return {
          ...base,
          actionType: it.action_type,
        } satisfies Writable<Action> as Action;
      // The action_type enum still has these labels, but no code creates
      // them and `Action` doesn't model them. The hand-written Kysely type
      // simply omitted them.
      case 'ACCEPT_APPEAL':
      case 'REJECT_APPEAL':
        throw new Error(`Unsupported action type ${it.action_type}`);
      default:
        assertUnreachable(it.action_type);
    }
  }

  async #getManager(readFromReplica: boolean = false) {
    return managerOf(readFromReplica ? this.pgQueryReplica : this.pgQuery);
  }

  async #validateItemTypeIds(
    manager: EntityManager,
    orgId: string,
    itemTypeIds: readonly string[],
  ) {
    const uniqueIds = new Set(itemTypeIds);
    if (uniqueIds.size !== itemTypeIds.length) {
      throw makeInvalidActionItemTypeIdsError({ shouldErrorSpan: true });
    }
    if (itemTypeIds.length === 0) return;

    const matchingRows = await manager.find(ItemTypes, {
      select: { id: true },
      where: { org_id: orgId, id: In([...itemTypeIds]) },
    });
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
