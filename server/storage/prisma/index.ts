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
