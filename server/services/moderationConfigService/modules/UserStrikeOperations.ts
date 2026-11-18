import { type JsonObject } from 'type-fest';

import {
  type Prisma,
  type PrismaPgQueryable,
} from '../../../storage/prisma/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';
import { runInPrismaTransaction } from '../prismaTransaction.js';

const userStrikeThresholdPrismaSelect = {
  id: true,
  org_id: true,
  threshold: true,
  actions: true,
  action_parameters: true,
} as const satisfies Prisma.user_strike_thresholdsSelect;

function toUserStrikeThreshold(
  row: Prisma.user_strike_thresholdsGetPayload<{
    select: typeof userStrikeThresholdPrismaSelect;
  }>,
) {
  return {
    // An integer column whose Kysely type was `string` (pg returned a
    // number); the GraphQL `ID` field types it as a string.
    id: String(row.id),
    orgId: row.org_id,
    threshold: row.threshold,
    actions: row.actions,
    actionParameters: row.action_parameters as JsonObject,
  };
}

export default class UserStrikeOperations {
  constructor(
    private readonly pgQuery: PrismaPgQueryable,
    private readonly pgQueryReplica: PrismaPgQueryable,
  ) {}

  async getUserStrikeThresholds(opts: {
    orgId: string;
    readFromReplica?: boolean;
  }) {
    const { orgId, readFromReplica } = opts;
    const pgQuery = this.#getPgQuery(readFromReplica);
    const rows = await pgQuery.user_strike_thresholds.findMany({
      select: userStrikeThresholdPrismaSelect,
      where: { org_id: orgId },
    });
    return rows.map(toUserStrikeThreshold);
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
      return toUserStrikeThreshold(
        await this.pgQuery.user_strike_thresholds.create({
          data: {
            org_id,
            threshold: thresholdSettings.threshold,
            actions: thresholdSettings.actions,
            action_parameters: thresholdSettings.actionParameters ?? {},
          },
          select: userStrikeThresholdPrismaSelect,
        }),
      );
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
      const updated = (
        await this.pgQuery.user_strike_thresholds.updateManyAndReturn({
          data: removeUndefinedKeys({
            threshold: thresholdSettings.threshold,
            actions: thresholdSettings.actions,
            action_parameters: thresholdSettings.actionParameters,
          }),
          // The id column is an integer; the API carries it as a string,
          // which Postgres coerced implicitly under Kysely.
          where: { id: Number(thresholdSettings.id), org_id: orgId },
          select: userStrikeThresholdPrismaSelect,
        })
      ).at(0);
      if (updated === undefined) {
        throw new Error('no result');
      }
      return toUserStrikeThreshold(updated);
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
    await runInPrismaTransaction(this.pgQuery, {}, async (trx) => {
      await trx.user_strike_thresholds.deleteMany({
        where: { org_id: opts.orgId },
      });
      for (const threshold of opts.thresholds) {
        await trx.user_strike_thresholds.upsert({
          where: {
            org_id_threshold: {
              org_id: opts.orgId,
              threshold: threshold.threshold,
            },
          },
          create: {
            org_id: opts.orgId,
            threshold: threshold.threshold,
            actions: [...threshold.actions],
            action_parameters: threshold.actionParameters ?? {},
          },
          update: {
            actions: [...threshold.actions],
            action_parameters: threshold.actionParameters ?? {},
          },
          select: { id: true },
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

    await this.pgQuery.user_strike_thresholds.deleteMany({
      where: { org_id: orgId, id: Number(id), threshold },
    });

    // Unconditional, as in the Kysely implementation, whose check on the
    // length of `execute()`'s result (always one DeleteResult) always passed.
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
