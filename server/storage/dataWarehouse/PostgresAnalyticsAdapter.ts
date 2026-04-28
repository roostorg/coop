/**
 * PostgreSQL analytics adapter stub - SAMPLE ONLY
 * 
 * This is a basic stub showing what you need to implement for PostgreSQL.
 * 
 * To implement:
 * - Use Kysely with PostgreSQL dialect
 * - Use COPY for bulk inserts
 * - Use logical replication for CDC (Debezium/pglogical)
 * - See ClickhouseAnalyticsAdapter for a concrete analytics adapter reference
 * - See ../README.md for implementation guide
 */

import { sql, type InsertObject, type Kysely } from 'kysely';
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
  // Each entry pairs a row buffer with a typed flush closure captured while
  // TableName is in scope in bulkWrite, so flushTable never needs a cast.
  private pendingWrites = new Map<
    string,
    { rows: unknown[]; flush: (rows: unknown[]) => Promise<void> }
  >();

  constructor(private readonly kysely: Kysely<AnalyticsSchema>) {}

  async bulkWrite<TableName extends keyof AnalyticsSchema>(
    tableName: TableName,
    rows: readonly AnalyticsSchema[TableName][],
    config?: BulkWriteConfig,
  ): Promise<void> {
    const tableKey = tableName as string;

    if (!this.pendingWrites.has(tableKey)) {
      this.pendingWrites.set(tableKey, {
        rows: [],
        // Closure captures the concrete TableName so Kysely can type-check
        // the insert at the call site where the generic is still in scope.
        flush: async (r) => {
          await this.kysely
            .insertInto(tableName)
            .values(r as ReadonlyArray<InsertObject<AnalyticsSchema, TableName>>)
            .execute();
        },
      });
    }
    this.pendingWrites.get(tableKey)!.rows.push(...rows);

    const batchSize = config?.batchSize ?? 500;
    const pending = this.pendingWrites.get(tableKey)!;

    if (config?.batchTimeout === 0 || pending.rows.length >= batchSize) {
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
    const pending = this.pendingWrites.get(tableName);
    if (!pending || pending.rows.length === 0) return;

    await pending.flush(pending.rows);
    pending.rows = [];
  }

  // Stub implementations - integrators must implement these
  logActionExecutions = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logRuleExecutions = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logItemModelScore = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logReportingRuleExecutions = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logContentApiRequest = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logContentDetailsApiRequest = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logRoutingRuleExecutions = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
  logOrgCreation = async (..._args: unknown[]): Promise<void> => {
    throw new Error('Not implemented');
  };
}

