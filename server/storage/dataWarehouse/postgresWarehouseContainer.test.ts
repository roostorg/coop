import { sql } from 'kysely';

import getBottle from '../../iocContainer/index.js';

async function backendPid(
  kysely: Parameters<ReturnType<typeof sql>['execute']>[0],
) {
  const { rows } = await sql<{
    pid: number;
  }>`SELECT pg_backend_pid() AS pid`.execute(kysely);
  return rows[0].pid;
}

describe('Postgres analytics warehouse in the service container', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('raw and Kysely warehouse queries share one analytics pool, separate from the app pool', async () => {
    vi.stubEnv('ANALYTICS_DIALECT', 'postgres');
    vi.stubEnv('WAREHOUSE_ADAPTER', undefined);
    vi.stubEnv('DATA_WAREHOUSE_PROVIDER', undefined);
    vi.stubEnv('ANALYTICS_ADAPTER', undefined);
    vi.stubEnv('ANALYTICS_DB_HOST', undefined);
    // With a single connection, services sharing the pool must all land on
    // the same Postgres backend; separate pools would each open their own.
    vi.stubEnv('ANALYTICS_DB_POOL_MAX', '1');

    const { container } = await getBottle();

    try {
      const [warehouseRow] = (await container.DataWarehouse.query(
        'SELECT pg_backend_pid() AS pid',
        container.Tracer,
      )) as { pid: number }[];
      const dialectPid = await backendPid(
        container.DataWarehouseDialect.getKyselyInstance(),
      );
      const appPid = await backendPid(container.KyselyPg);

      expect(dialectPid).toBe(warehouseRow.pid);
      expect(appPid).not.toBe(warehouseRow.pid);
    } finally {
      await container.closeSharedResourcesForShutdown();
    }
  });
});
