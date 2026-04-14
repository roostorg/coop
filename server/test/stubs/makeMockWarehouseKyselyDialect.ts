/* eslint-disable max-classes-per-file */
/**
 * Test-only Kysely dialect that compiles SQL with `:1` placeholders and
 * double-quoted identifiers (matching the style used by the data warehouse)
 * without requiring a real database connection.
 */
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

import { type MockedFn } from '../mockHelpers/jestMocks.js';

type WarehouseDriverConfig = {
  acquireConnection(): Promise<DatabaseConnection>;
  releaseConnection(conn: DatabaseConnection): Promise<void>;
  destroyAllResources(): Promise<void>;
};

class WarehouseQueryCompiler extends DefaultQueryCompiler {
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

class WarehouseTestDriver implements Driver {
  constructor(private readonly config: WarehouseDriverConfig) {}

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
        'Only "read committed" and "repeatable read" isolation levels are supported.',
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

class WarehouseDialectForTests implements Dialect {
  constructor(private readonly opts: { connection: WarehouseDriverConfig }) {}

  createAdapter() {
    return {
      supportsCreateIfNotExists: false,
      supportsTransactionalDdl: false,
      supportsReturning: false,
      async acquireMigrationLock(): Promise<void> {
        throw new Error('Migrations with kysely not supported in test dialect.');
      },
      async releaseMigrationLock(): Promise<void> {
        throw new Error('Migrations with kysely not supported in test dialect.');
      },
    };
  }

  createDriver() {
    return new WarehouseTestDriver(this.opts.connection);
  }

  createIntrospector(_db: Kysely<unknown>): never {
    throw new Error('Introspection not supported in test dialect.');
  }

  createQueryCompiler() {
    return new WarehouseQueryCompiler();
  }
}

export function makeMockWarehouseDialect(
  executeMockFn: MockedFn<
    (it: CompiledQuery) => Promise<QueryResult<unknown>>
  >,
) {
  async function* emptyStream(): AsyncIterableIterator<never> {
    throw new Error('not supported');
  }

  return new WarehouseDialectForTests({
    connection: {
      async acquireConnection() {
        return {
          executeQuery: executeMockFn as DatabaseConnection['executeQuery'],
          streamQuery:
            emptyStream as unknown as DatabaseConnection['streamQuery'],
        };
      },
      async releaseConnection() {},
      async destroyAllResources() {},
    },
  });
}
