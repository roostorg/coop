import otel from '@opentelemetry/api';
import type pg from 'pg';
import * as superTest from 'supertest';
import { vi, type Mock, type Mocked } from 'vitest';

import getBottle, {
  getPgConnectionParams,
  type Dependencies,
} from '../iocContainer/index.js';
import makeServer from '../server.js';
import { type IDataWarehouse } from '../storage/dataWarehouse/IDataWarehouse.js';
import type { IDataWarehouseAnalytics } from '../storage/dataWarehouse/IDataWarehouseAnalytics.js';
import SafeTracer from '../utils/SafeTracer.js';
import { createTransactionalTestDb } from './harness/transactionalPgPool.js';

/**
 * Occassionally, we make a request that's supposed to error, so this function
 * lets us temporarily suppress console messages, to keep our output a bit nicer.
 */
export function disableConsoleLogging() {
  /* eslint-disable functional/immutable-data */
  const noop = () => {};
  const { log, error } = console;
  console.log = noop;
  console.error = noop;
  return () => {
    console.log = log;
    console.error = error;
  };
  /* eslint-enable functional/immutable-data */
}

/**
 * Boots the Express app against real Postgres (analytics and queues mocked),
 * inside a transaction that `rollback()` discards so tests need no cleanup.
 * Only Postgres is rolled back. Usually used via
 * `makeTransactionalTestWithFixture`.
 */
export async function makeMockedServer() {
  const tdb = createTransactionalTestDb(getPgConnectionParams());
  await tdb.begin();

  const deps = await getBottleContainerWithIOMocks({ kyselyPool: tdb.pool });
  const { app: server, shutdown: shutdownServer } = await makeServer(deps);
  const request = superTest.agent(server);

  return {
    deps,
    server,
    request,
    /** Roll back everything written to Postgres during the test. */
    rollback: tdb.rollback,
    async shutdown() {
      try {
        await shutdownServer();
      } finally {
        await tdb.end();
      }
    },
  };
}

export type MockedServer = Awaited<ReturnType<typeof makeMockedServer>>;

export async function getBottleContainerWithIOMocks(
  opts: { kyselyPool?: pg.Pool } = {},
) {
  const bottle = await getBottle();

  // Optional Postgres pool override (used by the transaction-rollback harness
  // to route all PG access through a single rolled-back connection). Applied
  // before the container resolves anything so every service is built on it.
  if (opts.kyselyPool != null) {
    const pool = opts.kyselyPool;
    bottle.factory('KyselyPgPool', () => pool);
    bottle.factory('KyselyPgReadReplica', (container) => container.KyselyPg);
  }

  // The mutation rule below is a false positive, as we're just doing
  // initial setup on this mock object before exposing it.

  const tracer = new SafeTracer(
    new otel.ProxyTracerProvider().getTracer('noop'),
  );

  const queryMock = vi.fn(
    async (_query: string, _tracer: SafeTracer, _binds?: readonly unknown[]) =>
      [] as unknown[],
  ) as Mock<IDataWarehouse['query']>;

  const transactionImpl: IDataWarehouse['transaction'] = async (fn) =>
    fn(async (sql, binds) => queryMock(sql, tracer, binds));

  const startMock = vi.fn(() => {}) as IDataWarehouse['start'];
  const closeMock = vi.fn(async () => {}) as IDataWarehouse['close'];
  const getProviderMock = vi.fn(
    () => 'clickhouse',
  ) as IDataWarehouse['getProvider'];

  const dataWarehouseMock: IDataWarehouse = {
    query: queryMock,
    transaction: transactionImpl,
    start: startMock,
    close: closeMock,
    getProvider: getProviderMock,
  };

  const analyticsMock = {
    bulkWrite: vi.fn(async () => {}),
    createCDCStream: vi.fn(async () => {}),
    consumeCDCChanges: vi.fn(async () => {}),
    supportsCDC: vi.fn(() => false),
    flushPendingWrites: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  } as unknown as Mocked<IDataWarehouseAnalytics>;

  // This harness does not run item-processing workers. Keep queue I/O mocked
  // too, avoiding real Redis connections and the writers' 1.5s drain delay on
  // every shutdown. The integration harness still uses the real queues.
  for (const name of [
    'itemSubmissionQueueBulkWrite',
    'itemSubmissionRetryQueueBulkWrite',
  ] as const) {
    bottle.value(
      name,
      Object.assign(
        vi.fn(async () => ({ error: false, results: [] })),
        {
          close: vi.fn(async () => {}),
        },
      ),
    );
  }

  bottle.value('DataWarehouse', dataWarehouseMock);
  bottle.value('DataWarehouseAnalytics', analyticsMock);
  bottle.value('Tracer', tracer);
  return bottle.container as unknown as Omit<
    Dependencies,
    'DataWarehouse' | 'DataWarehouseAnalytics'
  > & {
    DataWarehouse: typeof dataWarehouseMock;
    DataWarehouseAnalytics: typeof analyticsMock;
  };
}
