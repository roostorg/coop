/**
 * PostgreSQL analytics adapter stub - SAMPLE ONLY
 * 
 * This is a basic stub showing what you need to implement for PostgreSQL.
 * 
 * To implement:
 * - Use Kysely with PostgreSQL dialect
 * - Use COPY for bulk inserts
 * - Use logical replication for CDC (Debezium/pglogical)
 * - See SnowflakeAnalyticsAdapter.ts for reference
 * - See ../README.md for implementation guide
 */

import { sql, type Kysely } from 'kysely';
import type SafeTracer from '../../utils/SafeTracer.js';
import {
  type IDataWarehouseAnalytics,
  type AnalyticsSchema,
  type BulkWriteConfig,
  type CDCConfig,
  type CDCChange,
} from './IDataWarehouseAnalytics.js';

/**
 * PostgreSQL analytics adapter
 * Uses batch inserts and logical replication for CDC
 */
export class PostgresAnalyticsAdapter implements IDataWarehouseAnalytics {
  private pendingWrites: Map<string, any[]> = new Map();

  constructor(private readonly kysely: Kysely<any>) {}

  async bulkWrite<TableName extends keyof AnalyticsSchema>(
    tableName: TableName,
    rows: readonly AnalyticsSchema[TableName][],
    config?: BulkWriteConfig,
  ): Promise<void> {
    const tableKey = tableName as string;

    if (!this.pendingWrites.has(tableKey)) {
      this.pendingWrites.set(tableKey, []);
    }
    this.pendingWrites.get(tableKey)!.push(...rows);

    const batchSize = config?.batchSize ?? 500;
    const pending = this.pendingWrites.get(tableKey)!;

    if (config?.batchTimeout === 0 || pending.length >= batchSize) {
      await this.flushTable(tableKey);
    }
  }

  async createCDCStream<TableName extends string>(
    config: CDCConfig<TableName>,
  ): Promise<void> {
    const { tableName, schemaName = 'public' } = config;
    await sql`ALTER TABLE ${sql.ref(`${schemaName}.${tableName}`)} REPLICA IDENTITY FULL`.execute(
      this.kysely,
    );
    await sql`CREATE PUBLICATION IF NOT EXISTS ${sql.raw(tableName)}_cdc FOR TABLE ${sql.ref(`${schemaName}.${tableName}`)}`.execute(
      this.kysely,
    );
  }

  async consumeCDCChanges<T = unknown>(
    _streamName: string,
    _callback: (changes: CDCChange<T>[]) => Promise<void>,
    _tracer: SafeTracer,
  ): Promise<void> {
    throw new Error(
      'PostgreSQL CDC consumption requires external tools like Debezium. See INTEGRATOR_GUIDE.md',
    );
  }

  supportsCDC(): boolean {
    return true;
  }

  async flushPendingWrites(): Promise<void> {
    for (const [tableName] of this.pendingWrites) {
      await this.flushTable(tableName);
    }
  }

  async close(): Promise<void> {
    await this.flushPendingWrites();
  }

  private async flushTable(tableName: string): Promise<void> {
    const rows = this.pendingWrites.get(tableName);
    if (!rows || rows.length === 0) return;

    await this.kysely.insertInto(tableName as any).values(rows).execute();
    this.pendingWrites.set(tableName, []);
  }

  // Stub implementations - integrators must implement these
  logActionExecutions = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logRuleExecutions = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logItemModelScore = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logReportingRuleExecutions = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logContentApiRequest = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logContentDetailsApiRequest = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logRoutingRuleExecutions = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logOrgCreation = async (..._args: any[]): Promise<void> => {
    throw new Error('Not implemented');
  };
}

