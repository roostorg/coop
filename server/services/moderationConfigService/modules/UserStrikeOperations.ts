import { type Kysely } from 'kysely';

import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import { type ModerationConfigServicePg } from '../dbTypes.js';

const userStrikeThresholdSelection = [
  'id',
  'org_id as orgId',
  'threshold',
  'actions',
] as const;

export default class UserStrikeOperations {
  constructor(
    private readonly pgQuery: Kysely<ModerationConfigServicePg>,
    private readonly pgQueryReplica: Kysely<ModerationConfigServicePg>,
  ) {}

  async getUserStrikeThresholds(opts: {
    orgId: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const query = pgQuery
      .selectFrom('public.user_strike_thresholds')
      .select(userStrikeThresholdSelection)
      .where('org_id', '=', orgId);
    return query.execute();
  }

  async createUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: {
      threshold: number;
      actions: string[];
    };
  }) {
    const { orgId: org_id, thresholdSettings } = opts;

    try {
      return await this.pgQuery
        .insertInto('public.user_strike_thresholds')
        .values({
          org_id,
          threshold: thresholdSettings.threshold,
          actions: thresholdSettings.actions,
        })
        .returning(userStrikeThresholdSelection)
        .executeTakeFirstOrThrow();
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeThresholdAlreadyExistsError({ shouldErrorSpan: true })
        : e;
    }
  }

  async updateUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: {
      id: string;
      threshold?: number;
      actions?: string[];
    };
  }) {
    const { orgId, thresholdSettings } = opts;

    try {
      return await this.pgQuery
        .updateTable('public.user_strike_thresholds')
        .set(
          removeUndefinedKeys({
            threshold: thresholdSettings.threshold,
            actions: thresholdSettings.actions,
          }),
        )
        .where('id', '=', thresholdSettings.id)
        .where('org_id', '=', orgId)
        .returning(userStrikeThresholdSelection)
        .executeTakeFirstOrThrow();
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeThresholdAlreadyExistsError({ shouldErrorSpan: true })
        : e;
    }
  }
  /**
   * Set all user strike thresholds for an organization.
   * this replaces all existing thresholds with the new set
   */
  async setAllUserStrikeThresholds(opts: {
    orgId: string;
    thresholds: readonly {
      threshold: number;
      actions: readonly string[];
    }[];
  }) {
    await this.pgQuery.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('public.user_strike_thresholds')
        .where('org_id', '=', opts.orgId)
        .execute();
      for (const threshold of opts.thresholds) {
        await trx
          .insertInto('public.user_strike_thresholds')
          .values({
            org_id: opts.orgId,
            threshold: threshold.threshold,
            actions: [...threshold.actions],
          })
          .onConflict((oc) =>
            oc.columns(['org_id', 'threshold']).doUpdateSet({
              actions: [...threshold.actions],
            }),
          )
          .execute();
      }
    });
  }

  async deleteUserStrikeThreshold(opts: {
    orgId: string;
    threshold: number;
    id: string;
  }) {
    const { orgId, id, threshold } = opts;

    const rowsDeleted = await this.pgQuery
      .deleteFrom('public.user_strike_thresholds')
      .where('org_id', '=', orgId)
      .where('id', '=', id)
      .where('threshold', '=', threshold)
      .execute();

    return rowsDeleted.length === 1;
  }

  #getPgQuery(readFromReplica: boolean = false) {
    return readFromReplica ? this.pgQueryReplica : this.pgQuery;
  }
}

export type UserStrikeThresholdErrorType =
  'UserStrikeThresholdAlreadyExistsError';

// TODO: throw this error on failed policy creation/update when appropriate.
export const makeThresholdAlreadyExistsError = (data: ErrorInstanceData) =>
  new CoopError({
    status: 409,
    type: [ErrorType.UniqueViolation],
    title:
      'A rule with that threshold value already exists in this organization.',
    name: 'UserStrikeThresholdAlreadyExistsError',
    ...data,
  });
