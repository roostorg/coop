import { and, eq, sql } from 'drizzle-orm';
import { type JsonObject } from 'type-fest';

import { schema, type CoopDbOrTx } from '../../../storage/postgres/drizzle.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import { runInTransaction } from './drizzleTx.js';

const thresholds = schema.userStrikeThresholds;

const userStrikeThresholdSelection = {
  // The column is an integer identity, but the Kysely dbTypes (and so this
  // service's callers and the GraphQL type) treat it as a string; pg returned
  // a number at runtime. Typed as before; the runtime value is unchanged.
  id: sql<string>`${thresholds.id}`,
  orgId: thresholds.orgId,
  threshold: thresholds.threshold,
  actions: thresholds.actions,
  actionParameters: thresholds.actionParameters,
};

function throwNoResult(): never {
  throw new Error('no result');
}

export default class UserStrikeOperations {
  constructor(
    private readonly pgQuery: CoopDbOrTx,
    private readonly pgQueryReplica: CoopDbOrTx,
  ) {}

  async getUserStrikeThresholds(opts: {
    orgId: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    return pgQuery
      .select(userStrikeThresholdSelection)
      .from(thresholds)
      .where(eq(thresholds.orgId, orgId));
  }

  async createUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: {
      threshold: number;
      actions: string[];
      actionParameters?: JsonObject;
    };
  }) {
    const { orgId: org_id, thresholdSettings } = opts;

    try {
      const [row] = await this.pgQuery
        .insert(thresholds)
        .values({
          orgId: org_id,
          threshold: thresholdSettings.threshold,
          actions: thresholdSettings.actions,
          actionParameters: thresholdSettings.actionParameters ?? {},
        })
        .returning(userStrikeThresholdSelection);
      return row ?? throwNoResult();
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
      actionParameters?: JsonObject;
    };
  }) {
    const { orgId, thresholdSettings } = opts;

    try {
      const [row] = await this.pgQuery
        .update(thresholds)
        .set(
          removeUndefinedKeys({
            threshold: thresholdSettings.threshold,
            actions: thresholdSettings.actions,
            actionParameters: thresholdSettings.actionParameters,
          }),
        )
        .where(
          and(
            // The id column is an integer; callers pass the GraphQL ID string.
            sql`${thresholds.id} = ${thresholdSettings.id}`,
            eq(thresholds.orgId, orgId),
          ),
        )
        .returning(userStrikeThresholdSelection);
      return row ?? throwNoResult();
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
      actionParameters?: JsonObject;
    }[];
  }) {
    await runInTransaction(this.pgQuery, async (trx) => {
      await trx.delete(thresholds).where(eq(thresholds.orgId, opts.orgId));
      for (const threshold of opts.thresholds) {
        await trx
          .insert(thresholds)
          .values({
            orgId: opts.orgId,
            threshold: threshold.threshold,
            actions: [...threshold.actions],
            actionParameters: threshold.actionParameters ?? {},
          })
          .onConflictDoUpdate({
            target: [thresholds.orgId, thresholds.threshold],
            set: {
              actions: [...threshold.actions],
              actionParameters: threshold.actionParameters ?? {},
            },
          });
      }
    });
  }

  async deleteUserStrikeThreshold(opts: {
    orgId: string;
    threshold: number;
    id: string;
  }) {
    const { orgId, id, threshold } = opts;

    await this.pgQuery
      .delete(thresholds)
      .where(
        and(
          eq(thresholds.orgId, orgId),
          sql`${thresholds.id} = ${id}`,
          eq(thresholds.threshold, threshold),
        ),
      );

    // Kysely's `execute()` on a DELETE always returned one result object, so
    // the old `rowsDeleted.length === 1` was always true; kept as-is.
    return true;
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
