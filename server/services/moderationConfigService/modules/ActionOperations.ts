/* eslint-disable max-lines -- action transaction and error definitions stay colocated */
import { type JsonObject, type JsonValue, type Writable } from 'type-fest';
import { uid } from 'uid';

import {
  Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
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
import { assertUnreachable, removeUndefinedKeys } from '../../../utils/misc.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { type Action, type CustomAction } from '../index.js';
import { runInPrismaTransaction } from '../prismaTransaction.js';
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

const actionPrismaSelect = {
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
} as const satisfies Prisma.actionsSelect;

type ActionPrismaRow = Prisma.actionsGetPayload<{
  select: typeof actionPrismaSelect;
}>;

// The row shape the Kysely selection produced, kept as the mapping target so
// `#dbResultToAction` still gets a row correlated by `actionType`.
type ActionDbSelection = readonly [
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
];

type ActionDbResult = FixKyselyRowCorrelation<
  ModerationConfigServicePg['public.actions'],
  ActionDbSelection
>;

// Prisma can't alias columns, so rename here; JSON columns come back as
// Prisma.JsonValue and are cast to their domain types.
function actionRowToDbResult(row: ActionPrismaRow): ActionDbResult {
  const result = {
    id: row.id,
    name: row.name,
    description: row.description,
    callbackUrl: row.callback_url,
    callbackUrlHeaders: row.callback_url_headers as JsonObject | null,
    callbackUrlBody: row.callback_url_body as JsonObject | null,
    orgId: row.org_id,
    penalty: row.penalty,
    actionType: row.action_type,
    appliesToAllItemsOfKind: row.applies_to_all_items_of_kind,
    applyUserStrikes: row.apply_user_strikes,
    customMrtApiParams: row.custom_mrt_api_params as JsonValue[],
  };
  // Prisma's row isn't correlated by action_type (and its action_type enum
  // has values the TS ActionType lacks), so this is an unchecked cast.
  return result as ActionDbResult;
}

/** Prisma needs `Prisma.DbNull` to write SQL NULL into a nullable Json column. */
function jsonOrDbNull(
  value: JsonObject | null,
): JsonObject | typeof Prisma.DbNull;
function jsonOrDbNull(
  value: JsonObject | null | undefined,
): JsonObject | typeof Prisma.DbNull | undefined;
function jsonOrDbNull(value: JsonObject | null | undefined) {
  return value === null ? Prisma.DbNull : value;
}

export default class ActionOperations {
  constructor(
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
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

    return runInPrismaTransaction(this.pgQuery, {}, async (trx) => {
      try {
        if (input.itemTypeIds !== undefined) {
          await this.#validateItemTypeIds(trx, orgId, input.itemTypeIds);
        }
        const actionRow = actionRowToDbResult(
          await trx.actions.create({
            data: {
              id: uid(),
              name: input.name,
              description: input.description,
              org_id: orgId,
              action_type: input.type,
              callback_url: input.callbackUrl,
              callback_url_headers: jsonOrDbNull(input.callbackUrlHeaders),
              callback_url_body: jsonOrDbNull(input.callbackUrlBody),
              penalty: 'NONE',
              apply_user_strikes: input.applyUserStrikes ?? false,
              custom_mrt_api_params: serializeParameters(
                parameters,
              ) as Prisma.InputJsonValue[],
              updated_at: new Date(),
            },
            select: actionPrismaSelect,
          }),
        );

        if (input.itemTypeIds !== undefined && input.itemTypeIds.length > 0) {
          await trx.actions_and_item_types.createMany({
            data: input.itemTypeIds.map((item_type_id) => ({
              action_id: actionRow.id,
              item_type_id,
            })),
          });
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
    return runInPrismaTransaction(this.pgQuery, {}, async (trx) => {
      const existingByType = new Set(
        (
          await trx.actions.findMany({
            select: { action_type: true },
            where: { org_id: orgId, action_type: { not: 'CUSTOM_ACTION' } },
          })
        ).map((row) => row.action_type),
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
        callback_url_headers: Prisma.DbNull,
        callback_url_body: Prisma.DbNull,
        penalty: 'NONE' as const,
        apply_user_strikes: false,
        applies_to_all_items_of_kind: [...b.appliesToAllItemsOfKind],
        updated_at: new Date(),
      }));

      if (toInsert.length > 0) {
        await trx.actions.createMany({ data: toInsert, skipDuplicates: true });
      }

      const refreshed = await trx.actions.findMany({
        select: actionPrismaSelect,
        where: { org_id: orgId, action_type: { not: 'CUSTOM_ACTION' } },
      });

      return refreshed.map((row) =>
        this.#dbResultToAction(actionRowToDbResult(row)),
      );
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
    return runInPrismaTransaction(this.pgQuery, {}, async (trx) => {
      const existingRow = await trx.actions.findFirst({
        select: actionPrismaSelect,
        where: { id: actionId, org_id: orgId, action_type: 'CUSTOM_ACTION' },
      });

      if (existingRow == null) {
        throw makeNotFoundError('Action not found', { shouldErrorSpan: true });
      }
      const existing = actionRowToDbResult(existingRow);

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
        callback_url: patch.callbackUrl,
        callback_url_headers: jsonOrDbNull(patch.callbackUrlHeaders),
        callback_url_body: jsonOrDbNull(patch.callbackUrlBody),
        apply_user_strikes: patch.applyUserStrikes,
        custom_mrt_api_params:
          validatedParameters === undefined
            ? undefined
            : (serializeParameters(
                validatedParameters,
              ) as Prisma.InputJsonValue[]),
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
          await trx.actions.updateMany({
            data: { ...setPayload, updated_at: new Date() },
            where: { id: actionId, org_id: orgId },
          });
        }

        if (itemTypeIds !== undefined) {
          await trx.actions_and_item_types.deleteMany({
            where: { action_id: actionId },
          });
          if (itemTypeIds.length > 0) {
            await trx.actions_and_item_types.createMany({
              data: itemTypeIds.map((item_type_id) => ({
                action_id: actionId,
                item_type_id,
              })),
            });
          }
        }

        const refreshed = await trx.actions.findFirstOrThrow({
          select: actionPrismaSelect,
          where: { id: actionId, org_id: orgId },
        });

        const action = this.#dbResultToAction(actionRowToDbResult(refreshed));
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
    return runInPrismaTransaction(this.pgQuery, {}, async (trx) => {
      const row = await trx.actions.findFirst({
        select: { id: true },
        where: { id: actionId, org_id: orgId, action_type: 'CUSTOM_ACTION' },
      });

      if (row == null) {
        return false;
      }

      await trx.rules_and_actions.deleteMany({
        where: { action_id: actionId },
      });
      await trx.actions_and_item_types.deleteMany({
        where: { action_id: actionId },
      });
      await trx.actions.deleteMany({
        where: { id: actionId, org_id: orgId },
      });

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
      pgQuery.actions.findMany({
        select: actionPrismaSelect,
        where: {
          org_id: orgId,
          actions_and_item_types: { some: { item_type_id: itemTypeId } },
        },
      }),
      pgQuery.actions.findMany({
        select: actionPrismaSelect,
        where: {
          org_id: orgId,
          applies_to_all_items_of_kind: { has: itemTypeKind },
        },
      }),
    ]);

    const byId = new Map<string, ActionDbResult>();
    for (const row of [...viaJunction, ...viaAppliesAll]) {
      byId.set(row.id, actionRowToDbResult(row));
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
    const results = await pgQuery.actions.findMany({
      select: actionPrismaSelect,
      where: {
        org_id: orgId,
        ...(ids !== undefined ? { id: { in: [...ids] } } : {}),
      },
    });

    return results.map((it) => this.#dbResultToAction(actionRowToDbResult(it)));
  }

  // Returns each action attached to a rule paired with the parameter values
  // configured for it. Powers proactive rule execution and pre-fills the rule editor.
  async getActionsForRuleId(opts: {
    orgId: string;
    ruleId: string;
    readFromReplica?: boolean;
  }): Promise<readonly { action: Action; parameters: JsonObject }[]> {
    const { orgId, ruleId, readFromReplica } = opts;
    const results = await this.#getPgQuery(
      readFromReplica,
    ).rules_and_actions.findMany({
      select: {
        action_parameters: true,
        actions: { select: actionPrismaSelect },
      },
      where: { rule_id: ruleId, actions: { org_id: orgId } },
    });
    return results.map((it) => ({
      action: this.#dbResultToAction(actionRowToDbResult(it.actions)),
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
    trx: PrismaPgQueryable,
    orgId: string,
    itemTypeIds: readonly string[],
  ) {
    const uniqueIds = new Set(itemTypeIds);
    if (uniqueIds.size !== itemTypeIds.length) {
      throw makeInvalidActionItemTypeIdsError({ shouldErrorSpan: true });
    }
    if (itemTypeIds.length === 0) return;

    const matchingRows = await trx.item_types.findMany({
      select: { id: true },
      where: { org_id: orgId, id: { in: [...itemTypeIds] } },
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
