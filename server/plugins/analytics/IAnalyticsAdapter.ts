import type SafeTracer from '../../utils/SafeTracer.js';
import type {
  CDCChange,
  CDCConfig,
} from '../../storage/dataWarehouse/IDataWarehouseAnalytics.js';
import type {
  AnalyticsEventInput,
  AnalyticsQueryResult,
  AnalyticsWriteOptions,
} from './types.js';

/**
 * Contract implemented by every analytics adapter.
 *
 * Adapters are free to batch, buffer, or stream writes however they like.
 * The core application will await each call; adapters should ensure the
 * returned promise resolves once the data is durable (or appropriately queued)
 * according to their guarantees.
 */
export interface IAnalyticsAdapter {
  /** Human friendly provider name for logging / diagnostics. */
  readonly name: string;

  /**
   * Write analytics events to a logical table.
   *
   * @param table - Logical table identifier (e.g. 'RULE_EXECUTIONS').
   * @param events - Rows to persist. Adapters may mutate or enrich rows before
   *                 persistence, but should NOT mutate the original array.
   */
  writeEvents(
    table: string,
    events: readonly AnalyticsEventInput[],
    options?: AnalyticsWriteOptions,
  ): Promise<void>;

  /**
   * Execute an analytics query. Most adapters will translate the SQL string
   * into their native dialect before execution.
   */
  query<T = AnalyticsQueryResult>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<readonly T[]>;

  /** Flush any in-memory buffers. Called during graceful shutdown. */
  flush(): Promise<void>;

  /** Release external resources (connections, clients, etc.). */
  close(): Promise<void>;

  /** Optional support for change data capture streams. */
  createCDCStream?<TableName extends string>(
    config: CDCConfig<TableName>,
  ): Promise<void>;

  consumeCDCChanges?<T = unknown>(
    streamName: string,
    callback: (changes: CDCChange<T>[]) => Promise<void>,
    tracer?: SafeTracer,
  ): Promise<void>;

  supportsCDC?(): boolean;
}
