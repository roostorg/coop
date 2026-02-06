// NB: This file can only be imported from within a jest test (as the jest
// runtime actually makes the global jest variable available, which we're
// relying on here).

import otel from '@opentelemetry/api';
import * as superTest from 'supertest';

import getBottle, { type Dependencies } from '../iocContainer/index.js';
import makeServer from '../server.js';
import SafeTracer from '../utils/SafeTracer.js';
import { type IDataWarehouse } from '../storage/dataWarehouse/IDataWarehouse.js';
import type { IDataWarehouseAnalytics } from '../storage/dataWarehouse/IDataWarehouseAnalytics.js';

/**
 * Occassionally, we make a request that's supposed to error, so this function
 * lets us temporarily suppress console messages, to keep our output a bit nicer.
 */
export function disableConsoleLogging() {
  /* eslint-disable better-mutation/no-mutation */
  const noop = () => {};
  const { log, error } = console;
  console.log = noop;
  console.error = noop;
  return () => {
    console.log = log;
    console.error = error;
  };
  /* eslint-enable better-mutation/no-mutation */
}

export async function makeMockedServer() {
  const deps = await getBottleContainerWithIOMocks();
  const { app: server, shutdown } = await makeServer(deps);
  const request = superTest.agent(server);
  return { deps, server, shutdown, request };
}

export async function getBottleContainerWithIOMocks() {
  const bottle = await getBottle();

  // The mutation rule below is a false positive, as we're just doing
  // initial setup on this mock object before exposing it.
  /* eslint-disable better-mutation/no-mutation */
  const tracer = new SafeTracer(new otel.ProxyTracerProvider().getTracer('noop'));

  const queryMock = jest.fn(
    async (
      _query: string,
      _tracer: SafeTracer,
      _binds?: readonly unknown[],
    ) => [] as unknown[],
  ) as jest.MockedFunction<IDataWarehouse['query']>;

  const transactionImpl: IDataWarehouse['transaction'] = async (fn) =>
    fn(async (sql, binds) =>
      queryMock(sql, tracer, binds as readonly unknown[] | undefined),
    );

  const startMock = jest.fn(() => {}) as IDataWarehouse['start'];
  const closeMock = jest.fn(async () => {}) as IDataWarehouse['close'];
  const getProviderMock = jest.fn(() => 'snowflake') as IDataWarehouse['getProvider'];

  const dataWarehouseMock: IDataWarehouse = {
    query: queryMock,
    transaction: transactionImpl,
    start: startMock,
    close: closeMock,
    getProvider: getProviderMock,
  };

  const analyticsMock = {
    bulkWrite: jest.fn(async () => {}),
    createCDCStream: jest.fn(async () => {}),
    consumeCDCChanges: jest.fn(async () => {}),
    supportsCDC: jest.fn(() => false),
    flushPendingWrites: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  } as unknown as jest.Mocked<IDataWarehouseAnalytics>;
  /* eslint-enable better-mutation/no-mutation */

  bottle.value('DataWarehouse', dataWarehouseMock);
  bottle.value(
    'DataWarehouseAnalytics',
    analyticsMock,
  );
  bottle.value('Snowflake', dataWarehouseMock);
  bottle.value('Tracer', tracer);
  return bottle.container as unknown as Omit<
    Dependencies,
    'Snowflake' | 'DataWarehouse' | 'DataWarehouseAnalytics'
  > & {
    Snowflake: typeof dataWarehouseMock;
    DataWarehouse: typeof dataWarehouseMock;
    DataWarehouseAnalytics: typeof analyticsMock;
  };
}
