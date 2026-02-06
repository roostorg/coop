import { type Kysely } from 'kysely';
import { type JsonObject, type Writable } from 'type-fest';
import { uid } from 'uid';

import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import {
  type FixKyselyRowCorrelation,
  type FixSingleTableReturnedRowType,
} from '../../../utils/kysely.js';
import { assertUnreachable } from '../../../utils/misc.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';
import { type Action } from '../index.js';

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
] as const;

type ActionDbResult = FixKyselyRowCorrelation<
  ModerationConfigServicePg['public.actions'],
  typeof actionDbSelection
>;

export default class ActionOperations {
  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
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
      // TODO: linking specific item types not yet supported.
    },
  ) {
    return this.pgQuery.transaction().execute(async (trx) => {
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
        })
        .returning(actionDbSelection);

      // eslint-disable-next-line no-useless-catch
      try {
        const actionRow =
          (await query.executeTakeFirstOrThrow()) as FixSingleTableReturnedRowType<
            typeof query
          >;

        return this.#dbResultToAction(actionRow);
      } catch (e) {
        // TODO: catch specific error for duplicate action name and call
        // makeActionNameExistsError and throw that error instead.
        throw e;
      }
    });
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

    const results = (await query.execute()) as FixSingleTableReturnedRowType<
      typeof query
    >[];

    return results.map((it) => this.#dbResultToAction(it));
  }

  #dbResultToAction(it: ActionDbResult) {
    return {
      id: it.id,
      name: it.name,
      orgId: it.orgId,
      applyUserStrikes: it.applyUserStrikes,
      ...(() => {
        switch (it.actionType) {
          case 'CUSTOM_ACTION':
            return {
              actionType: it.actionType,
              callbackUrl: it.callbackUrl,
              callbackUrlBody: it.callbackUrlBody,
              callbackUrlHeaders: it.callbackUrlHeaders,
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
