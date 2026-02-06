import { readFileSync } from 'fs';
import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';

import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { wrapMigration, type DatabaseConfig } from '@roostorg/db-migrator';
import type { UmzugStorage } from 'umzug';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

interface ClickhouseConnectionOptions {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  username: string;
  password?: string;
  database: string;
}

const passwordFromEnv = process.env.CLICKHOUSE_PASSWORD;

const connectionOptions: ClickhouseConnectionOptions = {
  host: process.env.CLICKHOUSE_HOST ?? 'localhost',
  port: Number.parseInt(process.env.CLICKHOUSE_PORT ?? '8123', 10),
  protocol: (process.env.CLICKHOUSE_PROTOCOL as 'http' | 'https') ?? 'http',
  username: process.env.CLICKHOUSE_USERNAME ?? 'default',
  database: process.env.CLICKHOUSE_DATABASE ?? 'analytics',
  ...(passwordFromEnv ? { password: passwordFromEnv } : {}),
};

const MIGRATIONS_TABLE =
  process.env.CLICKHOUSE_MIGRATIONS_TABLE ?? 'MIGRATIONS_METADATA';

function createClickhouseClient(database?: string): ClickHouseClient {
  const { host, port, protocol, username, password } = connectionOptions;
  const url = `${protocol}://${host}:${port}`;

  return createClient({
    url,
    database: database ?? connectionOptions.database,
    username,
    ...(password ? { password } : {}),
    clickhouse_settings: {
      allow_experimental_object_type: 1,
    },
  });
}

class ClickhouseMigrationStorage implements UmzugStorage<ClickHouseClient> {
  private readonly client: ClickHouseClient;
  private readonly tableIdentifier: string;
  private isTableEnsured = false;

  constructor() {
    this.client = createClickhouseClient();
    this.tableIdentifier = `${connectionOptions.database}.${MIGRATIONS_TABLE}`;
  }

  async logMigration({ name }: { name: string }): Promise<void> {
    await this.ensureTable();
    await this.client.insert({
      table: this.tableIdentifier,
      format: 'JSONEachRow',
      values: [
        {
          name,
          executed_at: Math.floor(Date.now() / 1000),
        },
      ],
    });
  }

  async unlogMigration({ name }: { name: string }): Promise<void> {
    await this.ensureTable();
    await this.client.command({
      query: `ALTER TABLE ${this.tableIdentifier} DELETE WHERE name = {name:String}`,
      query_params: { name },
    });
  }

  async executed(): Promise<string[]> {
    await this.ensureTable();

    try {
      const result = await this.client.query({
        query: `SELECT name FROM ${this.tableIdentifier} ORDER BY executed_at`,
        format: 'JSONEachRow',
      });
      const rows = await result.json<{ name: string }>();
      return rows.map((row) => row.name);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        // ClickHouse error code 60 => TABLE_DOESNT_EXIST
        (error as { code?: number }).code === 60
      ) {
        return [];
      }
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.client.close();
  }

  private async ensureTable(): Promise<void> {
    if (this.isTableEnsured) {
      return;
    }

    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${this.tableIdentifier} (
          name String,
          executed_at DateTime64(3) DEFAULT now()
        )
        ENGINE = MergeTree
        ORDER BY (name)
        SETTINGS index_granularity = 1
      `,
    });

    this.isTableEnsured = true;
  }
}

export default {
  supportedEnvironments: ['staging', 'prod'],
  supportedScriptFormats: ['sql'] as const,
  defaultScriptFormat: 'sql' as const,
  scriptsDirectory: relativePath('../scripts/clickhouse'),

  createStorage() {
    return new ClickhouseMigrationStorage();
  },

  async destroyStorage(storage: ClickhouseMigrationStorage) {
    await storage.shutdown();
  },

  createContext(): ClickHouseClient {
    return createClickhouseClient();
  },

  async destroyContext(context: ClickHouseClient) {
    await context.close();
  },

  resolveScript(params) {
    const { path, name, context } = params;

    if (!path.endsWith('.sql')) {
      throw new Error(
        `Unsupported ClickHouse migration format for ${name}. Expected .sql file.`,
      );
    }

    const fileContents = readFileSync(path, 'utf8');
    const statements = splitSqlStatements(fileContents);
    const baseResult = {
      name,
      async up(): Promise<void> {
        for (const statement of statements) {
          if (!statement.length) {
            continue;
          }

          await context.command({ query: statement });
        }
      },
    };

    return wrapMigration(
      {
        runBefore: async () => {
          await context.command({
            query: 'SET allow_experimental_object_type = 1;',
          });
        },
      },
      baseResult,
    );
  },

  async dropDbAndDisconnect() {
    const client = createClickhouseClient(connectionOptions.database);

    try {
      await client.command({
        query: `DROP TABLE IF EXISTS ${connectionOptions.database}.${MIGRATIONS_TABLE}`,
      });
    } finally {
      await client.close();
    }
  },

  async prepareDbAndDisconnect() {
    const client = createClickhouseClient(connectionOptions.database);

    try {
      await client.command({
        query: `CREATE DATABASE IF NOT EXISTS ${connectionOptions.database}`,
      });
    } finally {
      await client.close();
    }
  },
} satisfies DatabaseConfig<'sql', ClickHouseClient, ClickhouseMigrationStorage>;

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';

  for (const line of sql.split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine.length || trimmedLine.startsWith('--')) {
      continue;
    }

    buffer += buffer.length ? `\n${line}` : line;

    if (trimmedLine.endsWith(';')) {
      const statement = buffer.replace(/;\s*$/u, '').trim();
      if (statement.length) {
        statements.push(statement);
      }
      buffer = '';
    }
  }

  const remaining = buffer.trim();
  if (remaining.length) {
    statements.push(remaining);
  }

  return statements;
}

