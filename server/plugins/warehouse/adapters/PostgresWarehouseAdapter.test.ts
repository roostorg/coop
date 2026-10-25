import { getPgConnectionParams } from '../../../iocContainer/index.js';
import { PostgresKyselyAdapter } from '../../../storage/dataWarehouse/PostgresAdapter.js';
import { PostgresWarehouseAdapter } from './PostgresWarehouseAdapter.js';

describe('PostgresWarehouseAdapter', () => {
  let dialect: PostgresKyselyAdapter;
  let adapter: PostgresWarehouseAdapter;

  beforeAll(() => {
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
  });

  afterAll(async () => {
    await adapter.close();
    await dialect.destroy();
  });

  test('runs queries with bound parameters', async () => {
    const rows = await adapter.query<{ n: number; s: string }>(
      'SELECT $1::int AS n, $2::text AS s',
      [42, "it's bound, not interpolated"],
    );
    expect(rows).toEqual([{ n: 42, s: "it's bound, not interpolated" }]);
  });

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

  test('rolls back and rethrows when the callback fails', async () => {
    await expect(
      adapter.transaction(async (query) => {
        await query('SELECT 1');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await adapter.query<{ ok: number }>('SELECT 1 AS ok');
    expect(rows).toEqual([{ ok: 1 }]);
  });

  test('close() leaves the shared pool open for the dialect', async () => {
    await adapter.close();
    const rows = await dialect
      .getKyselyInstance()
      .selectNoFrom((eb) => eb.cast<number>(eb.val(1), 'integer').as('ok'))
      .execute();
    expect(rows).toEqual([{ ok: 1 }]);
  });
});
