import { type JsonObject } from 'type-fest';

import {
  fromJsonColumn,
  managerOf,
  toJsonColumn,
  transactionWithRetry,
  type TypeormDb,
} from '../../../storage/typeorm/db.js';
import { UserStrikeThresholds } from '../../../storage/typeorm/entities/index.js';
import {
  CoopError,
  ErrorType,
  type ErrorInstanceData,
} from '../../../utils/errors.js';
import { isUniqueViolationError } from '../../../utils/kysely.js';
import { removeUndefinedKeys } from '../../../utils/misc.js';

type UserStrikeThresholdRow = {
  id: string;
  orgId: string;
  threshold: number;
  actions: string[];
  actionParameters: JsonObject;
};

function toRow(entity: UserStrikeThresholds): UserStrikeThresholdRow {
  return {
    // int4 in the database; the GraphQL ID (and the Kysely type) is a string.
    id: String(entity.id),
    orgId: entity.org_id,
    threshold: entity.threshold,
    actions: entity.actions,
    actionParameters: fromJsonColumn(entity.action_parameters),
  };
}

export default class UserStrikeOperations {
  constructor(
    private readonly pgQuery: TypeormDb,
    private readonly pgQueryReplica: TypeormDb,
  ) {}

  async getUserStrikeThresholds(opts: {
    orgId: string;
    readFromReplica?: boolean;
  }): Promise<UserStrikeThresholdRow[]> {
    const manager = await managerOf(
      opts.readFromReplica ? this.pgQueryReplica : this.pgQuery,
    );
    const rows = await manager.find(UserStrikeThresholds, {
      where: { org_id: opts.orgId },
    });
    return rows.map(toRow);
  }

  async createUserStrikeThreshold(opts: {
    orgId: string;
    thresholdSettings: {
      threshold: number;
      actions: string[];
      actionParameters?: JsonObject;
    };
  }): Promise<UserStrikeThresholdRow> {
    const { orgId, thresholdSettings } = opts;
    const manager = await managerOf(this.pgQuery);
    try {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(UserStrikeThresholds)
        .values({
          org_id: orgId,
          threshold: thresholdSettings.threshold,
          actions: thresholdSettings.actions,
          // TypeORM's QueryDeepPartialEntity recursion on type-fest's
          // JsonObject hits TS2589 ("excessively deep") here.
          action_parameters: (thresholdSettings.actionParameters ??
            {}) as object,
        })
        .returning('*')
        .execute();
      return toRow(result.raw[0] as UserStrikeThresholds);
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
  }): Promise<UserStrikeThresholdRow> {
    const { orgId, thresholdSettings } = opts;
    const manager = await managerOf(this.pgQuery);
    let rows: UserStrikeThresholds[];
    try {
      const result = await manager
        .createQueryBuilder()
        .update(UserStrikeThresholds)
        .set(
          removeUndefinedKeys({
            threshold: thresholdSettings.threshold,
            actions: thresholdSettings.actions,
            action_parameters:
              thresholdSettings.actionParameters &&
              toJsonColumn(thresholdSettings.actionParameters),
          }),
        )
        .where('id = :id AND org_id = :orgId', {
          id: thresholdSettings.id,
          orgId,
        })
        .returning('*')
        .execute();
      rows = result.raw as UserStrikeThresholds[];
    } catch (e: unknown) {
      throw isUniqueViolationError(e)
        ? makeThresholdAlreadyExistsError({ shouldErrorSpan: true })
        : e;
    }
    if (rows.length === 0) {
      throw new Error('No user strike threshold to update');
    }
    return toRow(rows[0]);
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
    await transactionWithRetry(this.pgQuery, {}, async (manager) => {
      await manager.delete(UserStrikeThresholds, { org_id: opts.orgId });
      for (const threshold of opts.thresholds) {
        await manager.upsert(
          UserStrikeThresholds,
          {
            org_id: opts.orgId,
            threshold: threshold.threshold,
            actions: [...threshold.actions],
            action_parameters: toJsonColumn(threshold.actionParameters ?? {}),
          },
          ['org_id', 'threshold'],
        );
      }
    });
  }

  async deleteUserStrikeThreshold(opts: {
    orgId: string;
    threshold: number;
    id: string;
  }) {
    const { orgId, id, threshold } = opts;
    const manager = await managerOf(this.pgQuery);
    const result = await manager.delete(UserStrikeThresholds, {
      org_id: orgId,
      id: Number(id),
      threshold,
    });
    return result.affected === 1;
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
