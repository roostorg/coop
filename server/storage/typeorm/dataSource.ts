import 'reflect-metadata';

import pg from 'pg';
import { DataSource, type Logger } from 'typeorm';

import { entities } from './entities/index.js';

/**
 * Builds a TypeORM DataSource on top of an existing `pg.Pool`.
 *
 * TypeORM always constructs its own pool from connection options. Passing a
 * `driver` whose `Pool` constructor returns the pool we already have keeps
 * `createPgPool`'s error handling, the pool tuning in the IoC container and
 * the transactional test harness (which injects a pool-shaped facade) in
 * charge of connections. The pool's owner ends it, so TypeORM's `end()` is a
 * no-op.
 */
export function makeTypeormDataSource(
  pool: pg.Pool,
  opts: { logger?: Logger; logging?: boolean } = {},
) {
  const borrowedPool = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === 'end') {
        return async (callback?: (err?: Error) => void) => {
          callback?.();
        };
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const driver = {
    ...pg,
    defaults: pg.defaults,
    Pool: function PoolShim() {
      return borrowedPool;
    },
  };
  return new DataSource({
    type: 'postgres',
    driver,
    entities,
    // Schema changes are owned by the SQL migrations in /db.
    synchronize: false,
    migrationsRun: false,
    // The migrations already install pgcrypto/plpgsql; the app user may not
    // have CREATE EXTENSION rights.
    installExtensions: false,
    // Matches the migrations' `DEFAULT gen_random_uuid()`.
    uuidExtension: 'pgcrypto',
    logging: opts.logging ?? false,
    ...(opts.logger ? { logger: opts.logger } : {}),
  });
}

/**
 * IoC-friendly wrapper: BottleJS factories are synchronous but
 * `DataSource.initialize()` is not, so services `await handle.get()` and the
 * first call initializes.
 */
export class TypeormHandle {
  readonly #dataSource: DataSource;
  #ready: Promise<DataSource> | undefined;

  constructor(
    pool: pg.Pool,
    opts?: Parameters<typeof makeTypeormDataSource>[1],
  ) {
    this.#dataSource = makeTypeormDataSource(pool, opts);
  }

  async get(): Promise<DataSource> {
    this.#ready ??= this.#dataSource.initialize();
    return this.#ready;
  }

  async destroy() {
    if (this.#ready) {
      await (await this.#ready).destroy();
      this.#ready = undefined;
    }
  }
}
