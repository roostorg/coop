/* eslint-disable max-classes-per-file */
import {
  CompiledQuery,
  DefaultQueryCompiler,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
  type TransactionSettings,
} from 'kysely';
import { type Snowflake } from './snowflake-wrapper.js';

import makeSnowflakeConnectionPool, {
  type SnowflakeConnectionSettings,
  type SnowflakePoolOptions,
} from './makeConnectionPool.js';

type SnowflakeDriverConfig = {
  acquireConnection(): Promise<DatabaseConnection>;
  releaseConnection(conn: DatabaseConnection): Promise<void>;
  destroyAllResources(): Promise<void>;
};

/**
 * An adapter for integrating Kysely with Snowflake.
 */
export class SnowflakeDialect implements Dialect {
  constructor(
    private readonly opts: {
      connection: SnowflakeConnectionSettings | SnowflakeDriverConfig;
      pool?: SnowflakePoolOptions;
    },
  ) {}

  createAdapter() {
    return {
      supportsTransactionalDdl: false,
      supportsReturning: false,
      acquireMigrationLock(_db: Kysely<unknown>) {
        throw new Error('Snowflake migrations with kysely not supported.');
      },
      releaseMigrationLock(_db: Kysely<unknown>) {
        throw new Error('Snowflake migrations with kysely not supported.');
      },
    };
  }

  createDriver() {
    const driverConfig =
      'acquireConnection' in this.opts.connection
        ? this.opts.connection
        : ((): SnowflakeDriverConfig => {
            // We give kysely it's own connection pool for now, rather than
            // sharing the pool that the main `Snowflake` service uses, so that
            // shutting down that pool doesn't leave the kysely instance in an
            // invalid state. This is a bit wasteful, but it'll go away when we
            // move all snowflake queries to go through kysely.
            const pool = makeSnowflakeConnectionPool(
              this.opts.connection,
              this.opts.pool,
            );

            return {
              async acquireConnection() {
                return new KyselyConnection(await pool.acquire());
              },
              async releaseConnection(conn) {
                return pool.release((conn as KyselyConnection).rawConnection);
              },
              async destroyAllResources() {
                return pool.drain().then(async () => pool.clear());
              },
            };
          })();

    return new SnowflakeDriver(driverConfig);
  }

  createIntrospector(_db: Kysely<unknown>): never {
    throw new Error('Introspecting snowflake not yet supported.');
  }

  createQueryCompiler() {
    return new SnowflakeQueryCompiler();
  }
}

class SnowflakeQueryCompiler extends DefaultQueryCompiler {
  protected override getCurrentParameterPlaceholder() {
    return ':' + String(this.numParameters);
  }
  protected override getLeftIdentifierWrapper() {
    return '"';
  }
  protected override getRightIdentifierWrapper() {
    return '"';
  }
}

class SnowflakeDriver implements Driver {
  constructor(private readonly config: SnowflakeDriverConfig) {}

  public async init() {}

  public async acquireConnection() {
    return this.config.acquireConnection();
  }

  public async beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ) {
    const { isolationLevel } = settings;
    if (
      isolationLevel &&
      isolationLevel !== 'read committed' &&
      isolationLevel !== 'repeatable read'
    ) {
      throw new Error(
        'Snowflake only supports "read committed" and "repeatable read" isolation.',
      );
    }

    await connection.executeQuery(CompiledQuery.raw(`begin`));
  }

  public async commitTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw(`commit`));
  }

  public async rollbackTransaction(connection: DatabaseConnection) {
    await connection.executeQuery(CompiledQuery.raw(`rollback`));
  }

  public async releaseConnection(conn: DatabaseConnection) {
    await this.config.releaseConnection(conn);
  }

  public async destroy() {
    return this.config.destroyAllResources();
  }
}

class KyselyConnection implements DatabaseConnection {
  constructor(public readonly rawConnection: Snowflake) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    return {
      rows: await this.rawConnection.execute(
        compiledQuery.sql,
        // snowflake.execute doesn't mutate the binds its given,
        // but the types don't reflect that.
        compiledQuery.parameters satisfies readonly unknown[] as unknown[],
      ),
    };
  }

  streamQuery(_: unknown, __: unknown): never {
    throw new Error('Snowflake streaming not yet supported.');
  }
}
