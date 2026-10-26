import { getPgConnectionParams } from '../../../iocContainer/index.js';
import { PostgresKyselyAdapter } from '../../../storage/dataWarehouse/PostgresAdapter.js';
import { PostgresWarehouseAdapter } from './PostgresWarehouseAdapter.js';

const TABLE = 'public.postgres_warehouse_adapter_test';

describe('PostgresWarehouseAdapter', () => {
  let dialect: PostgresKyselyAdapter;
  let adapter: PostgresWarehouseAdapter;

  beforeAll(async () => {
    const params = getPgConnectionParams();
    dialect = new PostgresKyselyAdapter(
      {
        host: params.host!,
        port: params.port!,
        username: params.user!,
        password: String(params.password),
        database: params.database!,
        ssl: Boolean(params.ssl),
      },
      { max: 2 },
    );
    adapter = new PostgresWarehouseAdapter(dialect.getKyselyInstance());
    await adapter.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (id text)`);
  });

  beforeEach(async () => {
    await adapter.query(`TRUNCATE ${TABLE}`);
  });

  afterAll(async () => {
    await adapter.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await dialect.destroy();
  });

  // If statements escaped the transaction onto another pooled connection,
  // the second one would not see the transaction-local setting.
  test('runs transaction statements on a single connection', async () => {
    const result = await adapter.transaction(async (query) => {
      await query("SELECT set_config('application_name', $1, true)", [
        'coop-analytics-test',
      ]);
      return query<{ application_name: string }>(
        "SELECT current_setting('application_name') AS application_name",
      );
    });
    expect(result).toEqual([{ application_name: 'coop-analytics-test' }]);
  });

  test('commits writes when the callback succeeds', async () => {
    await adapter.transaction(async (query) => {
      await query(`INSERT INTO ${TABLE} (id) VALUES ($1)`, ['committed']);
    });

    const rows = await adapter.query(`SELECT id FROM ${TABLE}`);
    expect(rows).toEqual([{ id: 'committed' }]);
  });

  test('rolls back writes and rethrows when the callback fails', async () => {
    await expect(
      adapter.transaction(async (query) => {
        await query(`INSERT INTO ${TABLE} (id) VALUES ($1)`, ['rolled-back']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await adapter.query(`SELECT id FROM ${TABLE}`);
    expect(rows).toEqual([]);
  });
});
