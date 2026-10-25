import { Kysely, PostgresDialect } from 'kysely';

import { createPgPool } from '../../iocContainer/createPgPool.js';
import type {
  DataWarehousePoolSettings,
  IDataWarehouseDialect,
} from './IDataWarehouse.js';

export interface PostgresConnectionSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  statementTimeoutMs?: number;
}

/**
 * Kysely dialect for a Postgres-backed analytics warehouse. Owns the analytics
 * connection pool; the Postgres warehouse and analytics adapters run their
 * queries through this instance rather than opening pools of their own.
 */
export class PostgresKyselyAdapter implements IDataWarehouseDialect {
  private readonly kysely: Kysely<Record<string, unknown>>;

  constructor(
    connection: PostgresConnectionSettings,
    poolSettings?: DataWarehousePoolSettings,
  ) {
    const pool = createPgPool({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: connection.password,
      database: connection.database,
      ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
      max: poolSettings?.max,
      min: poolSettings?.min,
      application_name: 'coop-analytics',
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      ...(connection.statementTimeoutMs !== undefined && {
        statement_timeout: connection.statementTimeoutMs,
      }),
    });

    this.kysely = new Kysely<Record<string, unknown>>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  getKyselyInstance(): Kysely<Record<string, unknown>> {
    return this.kysely;
  }

  async destroy(): Promise<void> {
    await this.kysely.destroy();
  }
}
