import {
  markPrismaTransaction,
  Prisma,
  type PrismaPgClient,
  type PrismaPgTransaction,
} from '../storage/prisma/index.js';
import { safeGet } from './misc.js';

/**
 * Prisma reports both serialization failures (40001) and deadlocks (40P01) as
 * P2034. Only 40001 is retried, matching `makeKyselyTransactionWithRetry`; the
 * original SQLSTATE is on the driver adapter error.
 */
function isSerializationFailure(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2034'
  ) {
    return safeGet(error, ['code']) === '40001';
  }
  const originalCode = safeGet(error, [
    'meta',
    'driverAdapterError',
    'cause',
    'originalCode',
  ]);
  return originalCode === undefined || originalCode === '40001';
}

type TransactionWithRetryOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Max time (ms) the callback may run. Prisma's default is 5000. */
  timeout?: number;
};

/**
 * Prisma counterpart of `makeKyselyTransactionWithRetry`: runs an interactive
 * `$transaction` and retries (up to 3 attempts) on serialization failures.
 *
 * Callbacks must be retry-safe: on a 40001 the whole callback is re-run,
 * including any non-database side effects.
 */
export function makePrismaTransactionWithRetry(prisma: PrismaPgClient) {
  async function transactionWithRetry<R>(
    callback: (tx: PrismaPgTransaction) => Promise<R>,
  ): Promise<R>;
  async function transactionWithRetry<R>(
    options: TransactionWithRetryOptions,
    callback: (tx: PrismaPgTransaction) => Promise<R>,
  ): Promise<R>;
  async function transactionWithRetry<R>(
    optionsOrCallback:
      TransactionWithRetryOptions | ((tx: PrismaPgTransaction) => Promise<R>),
    maybeCallback?: (tx: PrismaPgTransaction) => Promise<R>,
  ): Promise<R> {
    const [options, callback] =
      typeof optionsOrCallback === 'function'
        ? [{}, optionsOrCallback]
        : [optionsOrCallback, maybeCallback!];

    let remainingTries = 3;
    let lastError: unknown;
    while (remainingTries > 0) {
      remainingTries -= 1;
      try {
        return await prisma.$transaction(
          async (tx) => callback(markPrismaTransaction(tx)),
          {
            ...(options.isolationLevel
              ? { isolationLevel: options.isolationLevel }
              : {}),
            timeout: options.timeout ?? 30_000,
          },
        );
      } catch (e: unknown) {
        if (!isSerializationFailure(e)) {
          throw e;
        }
        lastError = e;
      }
    }

    throw lastError;
  }

  return transactionWithRetry;
}

export type PrismaTransactionWithRetry = ReturnType<
  typeof makePrismaTransactionWithRetry
>;
