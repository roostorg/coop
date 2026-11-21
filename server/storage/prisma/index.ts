import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';

import { Prisma, PrismaClient } from '../../prisma-generated/client.js';

export { Prisma };
export type * as PrismaModels from '../../prisma-generated/models.js';
export * as PrismaEnums from '../../prisma-generated/enums.js';

/**
 * A Prisma client that runs every query through `pool`, so it shares
 * connections (and, in tests, the transactional harness) with Kysely while
 * both coexist.
 */
export function makePrismaClient(
  pool: pg.Pool,
  opts: { logQueries?: boolean } = {},
) {
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: opts.logQueries ? ['query', 'error'] : ['error'],
  });
}

export type PrismaPgClient = ReturnType<typeof makePrismaClient>;

/** The client handed to an interactive `$transaction` callback. */
export type PrismaPgTransaction = Prisma.TransactionClient;

/**
 * Either the root client or an interactive-transaction client. Modules that
 * can run inside a caller's transaction take this.
 */
export type PrismaPgQueryable = PrismaPgClient | PrismaPgTransaction;

const transactionClients = new WeakSet<object>();

/**
 * Records `tx` as an interactive-transaction client. Prisma's transaction
 * client is a proxy that still answers `'$transaction' in tx`, so membership
 * here is the only reliable test. `makePrismaTransactionWithRetry` calls this.
 */
export function markPrismaTransaction<T extends object>(tx: T): T {
  transactionClients.add(tx);
  return tx;
}

/** Prisma's counterpart to Kysely's `db.isTransaction`. */
export function isPrismaTransaction(
  client: PrismaPgQueryable,
): client is PrismaPgTransaction {
  return transactionClients.has(client);
}

/**
 * Prisma reads `in: []` as "matches nothing" and `notIn: []` as "matches
 * everything", so a `deleteMany` with `notIn: ids` removes every row when
 * `ids` is empty. Call this before filtering by a caller-supplied id list.
 */
export function assertNonEmptyIdList(name: string, ids: readonly unknown[]) {
  if (ids.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
}
