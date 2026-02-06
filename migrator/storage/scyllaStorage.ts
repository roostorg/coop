import {
  Client as ScyllaClient,
  type DseClientOptions,
} from 'cassandra-driver';

/**
 * Returns an object that can store migration state in Scylla, in a table called
 * `migrations_metadata`. If the table does not exist it will be created
 * automatically upon the logging of the first migration.
 */
export default class ScyllaStorage {
  private scyllaClient: ScyllaClient;
  private columnName: string;
  private tableName: string;
  private metadataExists: boolean;
  constructor(options: {
    driverOptions: DseClientOptions;
    columnName?: string;
    tableName?: string;
  }) {
    this.scyllaClient = new ScyllaClient(options.driverOptions);
    this.columnName = options.columnName ?? 'name';
    this.tableName = options.tableName ?? 'migrations_metadata';
    this.metadataExists = false;
  }

  private async createTable() {
    await this.scyllaClient.execute(
      `CREATE TABLE IF NOT EXISTS "${this.tableName}"(
        migration_static_key int,
        ${this.columnName} text,
        createdAt timestamp,
       PRIMARY KEY (migration_static_key, createdAt))`,
    );
    this.metadataExists = true;
  }

  async logMigration({ name: migrationName }: { name: string }) {
    if (!this.metadataExists) {
      await this.createTable();
    }
    await this.scyllaClient.execute(
      `INSERT INTO "${this.tableName}"(
        migration_static_key,
        ${this.columnName},
        createdAt
      ) VALUES ( ?, ?, ? )`,
      [1, migrationName, Date.now()],
      { prepare: true },
    );
  }

  async unlogMigration({ name: migrationName }: { name: string }) {
    await this.scyllaClient.execute(
      `DELETE FROM ?
      WHERE migration_static_key = 1
      AND "${this.columnName}" = ?`,
      [migrationName],
      { prepare: true },
    );
  }

  async executed() {
    try {
      const migrations = await this.scyllaClient.execute(
        `SELECT * FROM ${this.tableName} ALLOW FILTERING`,
      );

      const x = migrations.rows.map((migration: any) => {
        const name = migration[this.columnName];
        if (typeof name !== 'string') {
          throw new TypeError(
            `Unexpected migration name type: expected string, got ${typeof name}`,
          );
        }
        return name;
      });
      return x;
    } catch (e: any) {
      // 8704 is the CQL error code for 'unconfigured table' and will be returned in the
      // Error object when the metadata table has not been set up, e.g. on the first
      // migration run
      if (e.code === 8704) {
        return [];
      }
      throw e;
    }
  }

  async shutdown() {
    return this.scyllaClient.shutdown();
  }
}
