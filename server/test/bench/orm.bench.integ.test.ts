/* eslint-disable functional/immutable-data, security/detect-non-literal-fs-filename -- benchmark: patches pg.Client to count queries, writes to $BENCH_OUT */
import { appendFileSync } from 'node:fs';
import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';

import { getPgConnectionParams } from '../../iocContainer/index.js';
import { type CombinedPg } from '../../services/combinedDbTypes.js';
import { makePrismaClient } from '../../storage/prisma/index.js';

const out = (line: string) =>
  appendFileSync(process.env.BENCH_OUT!, line + '\n');

const N = Number(process.env.BENCH_N ?? 2000);

async function time(label: string, fn: () => Promise<unknown>) {
  for (let i = 0; i < Math.min(200, N); i++) await fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < N; i++) await fn();
  const us = Number(process.hrtime.bigint() - start) / 1000 / N;
  out(`${label.padEnd(48)} ${us.toFixed(1)} µs/op`);
}

// Opt-in: BENCH_OUT=<file> [BENCH_N=2000] vitest run --config vitest.integ.config.ts test/bench
it.skipIf(!process.env.BENCH_OUT)(
  'compares Kysely and Prisma on the same pool',
  { timeout: 300_000 },
  async () => {
    const pool = new pg.Pool({ ...getPgConnectionParams(), max: 4 });
    let queries = 0;
    const origClientQuery = pg.Client.prototype.query;
    pg.Client.prototype.query = function (this: pg.Client, ...a: unknown[]) {
      queries++;
      return (origClientQuery as (...x: unknown[]) => unknown).apply(this, a);
    } as typeof origClientQuery;
    const kysely = new Kysely<CombinedPg>({
      dialect: new PostgresDialect({ pool }),
    });
    const prisma = makePrismaClient(pool);
    const org = await prisma.orgs.findFirstOrThrow();

    await time('kysely: org by id', async () =>
      kysely
        .selectFrom('public.orgs')
        .selectAll()
        .where('id', '=', org.id)
        .executeTakeFirst(),
    );
    await time('prisma: org by id (findUnique)', async () =>
      prisma.orgs.findUnique({ where: { id: org.id } }),
    );
    await time('kysely: item types for org', async () =>
      kysely
        .selectFrom('public.item_types')
        .selectAll()
        .where('org_id', '=', org.id)
        .execute(),
    );
    await time('prisma: item types for org (findMany)', async () =>
      prisma.item_types.findMany({ where: { org_id: org.id } }),
    );
    await time('kysely: raw sql', async () =>
      sql`select 1 as x`.execute(kysely),
    );
    await time(
      'prisma: $queryRaw',
      async () => prisma.$queryRaw`select 1 as x`,
    );

    queries = 0;
    const orgs = await prisma.orgs.findMany({
      include: { item_types: true, actions: true, users: true },
    });
    out(
      `prisma include (orgs + 3 relations, ${orgs.length} orgs): ${queries} queries`,
    );
    queries = 0;
    for (const o of orgs)
      await prisma.item_types.findMany({ where: { org_id: o.id } });
    out(`naive per-org loop: ${queries} queries`);

    await kysely.destroy();
  },
);
