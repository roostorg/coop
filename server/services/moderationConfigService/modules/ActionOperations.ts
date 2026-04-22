import { type Kysely, sql } from 'kysely';
import { type JsonObject, type JsonValue, type Writable } from 'type-fest';
import { uid } from 'uid';

import {
  CoopError,
  ErrorType,
  makeNotFoundError,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import {
  isUniqueViolationError,
  type FixKyselyRowCorrelation,
} from '../../../utils/kysely.js';
import { makeKyselyTransactionWithRetry } from '../../../utils/kyselyTransactionWithRetry.js';
import { assertUnreachable, removeUndefinedKeys } from '../../../utils/misc.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { type Action, type CustomAction } from '../index.js';
import { type ItemTypeKind } from '../types/itemTypes.js';

function assertCustomAction(action: Action): asserts action is CustomAction {
  if (action.actionType !== 'CUSTOM_ACTION') {
    throw new Error(
      `Expected CUSTOM_ACTION but received ${action.actionType}`,
    );
  }
}

const actionDbSelection = [
  'id',
  'name',
  'description',
  'callback_url as callbackUrl',
  'callback_url_headers as callbackUrlHeaders',
  'callback_url_body as callbackUrlBody',
  'org_id as orgId',
  'penalty',
  'action_type as actionType',
  'applies_to_all_items_of_kind as appliesToAllItemsOfKind',
  'apply_user_strikes as applyUserStrikes',
  'custom_mrt_api_params as customMrtApiParams',
] as const;

const actionJoinDbSelection = [
  'a.id',
  'a.name',
  'a.description',
  'a.callback_url as callbackUrl',
  'a.callback_url_headers as callbackUrlHeaders',
  'a.callback_url_body as callbackUrlBody',
  'a.org_id as orgId',
  'a.penalty',
  'a.action_type as actionType',
  'a.applies_to_all_items_of_kind as appliesToAllItemsOfKind',
  'a.apply_user_strikes as applyUserStrikes',
  'a.custom_mrt_api_params as customMrtApiParams',
] as const;

type ActionDbResult = FixKyselyRowCorrelation<
  ModerationConfigServicePg['public.actions'],
  typeof actionDbSelection
>;

export default class ActionOperations {
  private readonly transactionWithRetry: ReturnType<
    typeof makeKyselyTransactionWithRetry<ModerationConfigServicePg>
  >;

  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
  ) {
    this.transactionWithRetry = makeKyselyTransactionWithRetry(this.pgQuery);
  }

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
    },
  ): Promise<CustomAction> {
    return this.transactionWithRetry(async (trx) => {
      try {
        const query = trx
          .insertInto('public.actions')
          .values({
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
            updated_at: new Date(),
          })
          .returning(actionDbSelection);

        const actionRow =
          (await query.executeTakeFirstOrThrow()) as ActionDbResult;

        if (input.itemTypeIds !== undefined && input.itemTypeIds.length > 0) {
          await trx
            .insertInto('public.actions_and_item_types')
            .values(
              input.itemTypeIds.map((item_type_id) => ({
                action_id: actionRow.id,
                item_type_id,
              })),
            )
            .execute();
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
    };
    itemTypeIds?: readonly string[] | undefined;
  }): Promise<CustomAction> {
    const { orgId, actionId, patch, itemTypeIds } = opts;
    return this.transactionWithRetry(async (trx) => {
      const existing = (await trx
        .selectFrom('public.actions')
        .select(actionDbSelection)
        .where('id', '=', actionId)
        .where('org_id', '=', orgId)
        .where('action_type', '=', 'CUSTOM_ACTION')
        .executeTakeFirst()) as ActionDbResult | undefined;

      if (existing == null) {
        throw makeNotFoundError('Action not found', { shouldErrorSpan: true });
      }

      const setPayload = removeUndefinedKeys({
        name: patch.name,
        description: patch.description,
        callback_url: patch.callbackUrl,
        callback_url_headers: patch.callbackUrlHeaders,
        callback_url_body: patch.callbackUrlBody,
        apply_user_strikes: patch.applyUserStrikes,
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
            .updateTable('public.actions')
            .set({
              ...setPayload,
              updated_at: new Date(),
            })
            .where('id', '=', actionId)
            .where('org_id', '=', orgId)
            .execute();
        }

        if (itemTypeIds !== undefined) {
          await trx
            .deleteFrom('public.actions_and_item_types')
            .where('action_id', '=', actionId)
            .execute();
          if (itemTypeIds.length > 0) {
            await trx
              .insertInto('public.actions_and_item_types')
              .values(
                itemTypeIds.map((item_type_id) => ({
                  action_id: actionId,
                  item_type_id,
                })),
              )
              .execute();
          }
        }

        const refreshed = (await trx
          .selectFrom('public.actions')
          .select(actionDbSelection)
          .where('id', '=', actionId)
          .where('org_id', '=', orgId)
          .executeTakeFirstOrThrow()) as ActionDbResult;

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
    return this.transactionWithRetry(async (trx) => {
      const row = await trx
        .selectFrom('public.actions')
        .select('id')
        .where('id', '=', actionId)
        .where('org_id', '=', orgId)
        .where('action_type', '=', 'CUSTOM_ACTION')
        .executeTakeFirst();

      if (row == null) {
        return false;
      }

      await trx
        .deleteFrom('public.rules_and_actions')
        .where('action_id', '=', actionId)
        .execute();
      await trx
        .deleteFrom('public.actions_and_item_types')
        .where('action_id', '=', actionId)
        .execute();
      await trx
        .deleteFrom('public.actions')
        .where('id', '=', actionId)
        .where('org_id', '=', orgId)
        .execute();

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

    const [viaJunction, viaAppliesAll] = await Promise.all([
      pgQuery
        .selectFrom('public.actions_and_item_types as ait')
        .innerJoin('public.actions as a', 'a.id', 'ait.action_id')
        .select(actionJoinDbSelection)
        .where('ait.item_type_id', '=', itemTypeId)
        .where('a.org_id', '=', orgId)
        .execute(),
      pgQuery
        .selectFrom('public.actions as a')
        .select(actionJoinDbSelection)
        .where('a.org_id', '=', orgId)
        .where(
          sql<boolean>`${itemTypeKind}::text = ANY(a.applies_to_all_items_of_kind::text[])`,
        )
        .execute(),
    ]);

    const junctionRows = viaJunction as ActionDbResult[];
    const appliesAllRows = viaAppliesAll as ActionDbResult[];

    const byId = new Map<string, ActionDbResult>();
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
    const pgQuery = this.#getPgQuery(readFromReplica);
    const query = pgQuery
      .selectFrom('public.actions')
      .select(actionDbSelection)
      .where('org_id', '=', orgId)
      .$if(ids !== undefined, (qb) => qb.where('id', 'in', ids!));

    const results = (await query.execute()) as ActionDbResult[];

    return results.map((it) => this.#dbResultToAction(it));
  }

  async getActionsForRuleId(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, ruleId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const results = (await pgQuery
      .selectFrom('public.rules_and_actions as raa')
      .innerJoin('public.actions as a', 'a.id', 'raa.action_id')
      .select(actionJoinDbSelection)
      .where('raa.rule_id', '=', ruleId)
      .where('a.org_id', '=', orgId)
      .execute()) as ActionDbResult[];

    return results.map((it) => this.#dbResultToAction(it));
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
              customMrtApiParams:
                ActionOperations.customMrtApiParamsFromDb(it.customMrtApiParams),
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
}

export type ActionErrorType = 'ActionNameExistsError';

export const makeActionNameExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title: 'An action with this name already exists',
    name: 'ActionNameExistsError',
    ...data,
  });
