import {
  isPrismaTransaction,
  type Prisma,
  type PrismaPgClient,
  type PrismaPgQueryable,
  type PrismaPgTransaction,
} from '../../storage/prisma/index.js';
import { makePrismaTransactionWithRetry } from '../../utils/prismaTransactionWithRetry.js';

/**
 * Runs `callback` in `db`'s transaction when `db` is already a transaction
 * client (e.g. a service built by `forTransaction`), otherwise in a new
 * transaction with retry. A joined transaction keeps the caller's isolation
 * level; `isolationLevel` only applies to a new one.
 */
export async function runInPrismaTransaction<R>(
  db: PrismaPgQueryable,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel },
  callback: (tx: PrismaPgTransaction) => Promise<R>,
): Promise<R> {
  return isPrismaTransaction(db)
    ? callback(db)
    : makePrismaTransactionWithRetry(db as PrismaPgClient)(options, callback);
}
