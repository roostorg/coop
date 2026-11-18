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
 * transaction with retry. A joined transaction can't change its isolation
 * level, so requesting one there throws rather than silently running weaker.
 */
export async function runInPrismaTransaction<R>(
  db: PrismaPgQueryable,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel },
  callback: (tx: PrismaPgTransaction) => Promise<R>,
): Promise<R> {
  if (isPrismaTransaction(db)) {
    if (options.isolationLevel !== undefined) {
      throw new Error(
        `Cannot run at ${options.isolationLevel} inside the caller's transaction`,
      );
    }
    return callback(db);
  }
  return makePrismaTransactionWithRetry(db as PrismaPgClient)(
    options,
    callback,
  );
}
