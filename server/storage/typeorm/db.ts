import { type JsonObject } from 'type-fest';
import { type EntityManager } from 'typeorm';
import { type IsolationLevel } from 'typeorm/driver/types/IsolationLevel.js';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { safeGet } from '../../utils/misc.js';
import { type TypeormHandle } from './dataSource.js';

/**
 * What a TypeORM-backed service is constructed with: the shared handle
 * (queries run on the pool) or the EntityManager of a caller's transaction
 * (queries join it). The TypeORM counterpart of passing either `Kysely<DB>`
 * or `Transaction<DB>`.
 */
export type TypeormDb = TypeormHandle | EntityManager;

export async function managerOf(db: TypeormDb): Promise<EntityManager> {
  return 'get' in db ? (await db.get()).manager : db;
}

export function isInTransaction(db: TypeormDb): db is EntityManager {
  return !('get' in db) && db.queryRunner?.isTransactionActive === true;
}

function isSerializationFailure(error: unknown): boolean {
  return safeGet(error, ['code']) === '40001';
}

/**
 * Runs `callback` in a transaction, joining the caller's when `db` already is
 * one. New transactions retry up to 3 times on serialization failures
 * (SQLSTATE 40001), so callbacks must be retry-safe, as with
 * `makeKyselyTransactionWithRetry`.
 *
 * When joining, `isolationLevel` is not applied: the work runs at the outer
 * transaction's level. (Kysely threw on nested transactions instead.) A real
 * migration should reject a stricter requested level here.
 */
export async function transactionWithRetry<R>(
  db: TypeormDb,
  options: { isolationLevel?: IsolationLevel },
  callback: (manager: EntityManager) => Promise<R>,
): Promise<R> {
  if (isInTransaction(db)) {
    return callback(db);
  }
  const manager = await managerOf(db);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await (options.isolationLevel
        ? manager.transaction(options.isolationLevel, callback)
        : manager.transaction(callback));
    } catch (e: unknown) {
      if (!isSerializationFailure(e)) {
        throw e;
      }
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Entity JSON columns are typed `Record<string, unknown>` because TypeORM's
 * `QueryDeepPartialEntity` / `FindOptionsWhere` hit TS2589 ("excessively
 * deep") on type-fest's recursive `JsonObject`, and even the shallow type
 * isn't assignable to TypeORM's write type. These casts mark the boundary.
 */
export const toJsonColumn = (value: JsonObject) =>
  value as QueryDeepPartialEntity<Record<string, unknown>>;
export const fromJsonColumn = (value: Record<string, unknown>) =>
  value as JsonObject;
