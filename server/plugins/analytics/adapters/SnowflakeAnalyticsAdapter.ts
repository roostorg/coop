import DataLoader from 'dataloader';
import { CompressionTypes } from 'kafkajs';
import { sql, CompiledQuery, type Kysely } from 'kysely';

import type { Kafka, KafkaProducer } from '../../../kafka/index.js';
import { jsonStringifyUnstable } from '../../../utils/encoding.js';
import { sleep } from '../../../utils/misc.js';
import type SafeTracer from '../../../utils/SafeTracer.js';
import type { IAnalyticsAdapter } from '../IAnalyticsAdapter.js';
import type {
  AnalyticsEventInput,
  AnalyticsQueryResult,
} from '../types.js';
import type {
  CDCChange,
  CDCConfig,
} from '../../../storage/dataWarehouse/IDataWarehouseAnalytics.js';
import type { AnalyticsWriteOptions } from '../types.js';

export interface SnowflakeAnalyticsAdapterOptions {
  kafka?: Kafka<any>;
  kafkaTopic?: string;
  batchSize?: number;
  batchTimeout?: number;
  compression?: boolean;
  tracer?: SafeTracer;
}

export class SnowflakeAnalyticsAdapter implements IAnalyticsAdapter {
  readonly name = 'snowflake-analytics';

  private kafkaProducer?: KafkaProducer<any>;
  private loader?: DataLoader<any, void>;
  private readonly batchTimeout: number;

  constructor(
    private readonly kysely: Kysely<any>,
    private readonly options: SnowflakeAnalyticsAdapterOptions,
  ) {
    this.batchTimeout = options.batchTimeout ?? 1_000;

    if (options.kafka) {
      this.kafkaProducer = options.kafka.producer();
      this.loader = new DataLoader(
        async (payloads: readonly any[]) => {
          await this.bulkOutboxWrite(payloads as any[]);
          return new Array(payloads.length).fill(undefined);
        },
        {
          cache: false,
          batch: true,
          maxBatchSize: options.batchSize ?? 200,
          batchScheduleFn: (dispatch) => {
            setTimeout(dispatch, this.batchTimeout);
          },
        },
      );
    }
  }

  async writeEvents(
    table: string,
    events: readonly AnalyticsEventInput[],
    options?: AnalyticsWriteOptions,
  ): Promise<void> {
    if (!this.kafkaProducer) {
      throw new Error('Snowflake analytics adapter requires Kafka configuration');
    }

    const payload = events.map((data) => ({
      table,
      data,
    }));

    if (events.length === 0) {
      return;
    }

    await this.kafkaProducer.connect();

    if (options?.batchTimeout === 0 || !this.loader) {
      await this.bulkOutboxWrite(payload);
      return;
    }

    await this.loader.loadMany(payload);
  }

  async query<T = AnalyticsQueryResult>(
    sqlStatement: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const compiled = CompiledQuery.raw(sqlStatement, params as unknown[]);
    const result = await this.kysely.executeQuery(compiled);
    return result.rows as readonly T[];
  }

  async flush(): Promise<void> {
    await this.flushPendingWrites();
  }

  async close(): Promise<void> {
    await this.flushPendingWrites();
    if (this.kafkaProducer) {
      await this.kafkaProducer.disconnect();
    }
  }

  supportsCDC(): boolean {
    return true;
  }

  async createCDCStream<TableName extends string>(
    config: CDCConfig<TableName>,
  ) {
    const { tableName, schemaName = 'PUBLIC' } = config;
    await sql`CREATE STREAM IF NOT EXISTS ${sql.raw(`${tableName}_STREAM`)} ON TABLE ${sql.raw(`${schemaName}.${tableName}`)}`.execute(this.kysely);
  }

  async consumeCDCChanges<T = unknown>(
    streamName: string,
    callback: (changes: CDCChange<T>[]) => Promise<void>,
    tracer?: SafeTracer,
  ): Promise<void> {
    const runner = async () => {
      await this.kysely.transaction().execute(async (trx) => {
        const changes = await trx
          .selectFrom(streamName as any)
          .selectAll()
          .execute();

        if (!changes.length) return;

        const mapped = changes.map((row: any) => {
          const action = row.METADATA$ACTION as
            | 'INSERT'
            | 'UPDATE'
            | 'DELETE';
          const rowId = row.METADATA$ROW_ID;
          const timestamp =
            rowId instanceof Date
              ? rowId
              : new Date(String(rowId ?? Date.now()));

          return {
            operation: action,
            before: action === 'DELETE' ? (row as T) : undefined,
            after: action !== 'DELETE' ? (row as T) : undefined,
            metadata: {
              timestamp,
              transactionId:
                rowId != null ? String(rowId) : undefined,
            },
          } satisfies CDCChange<T>;
        });

        await callback(mapped);

        await sql`INSERT INTO PUBLIC.ALL_ORGS (ID) SELECT 'ignored' FROM ${sql.raw(streamName)} WHERE 1=0`.execute(
          trx,
        );
      });
    };

    if (tracer) {
      await tracer.addActiveSpan(
        { resource: 'SnowflakeAnalytics', operation: 'consumeCDCChanges' },
        runner,
      );
      return;
    }

    await runner();
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.loader) {
      await sleep(this.batchTimeout + 1_000);
    }
  }

  private async bulkOutboxWrite(data: readonly any[]): Promise<void> {
    if (!this.kafkaProducer) return;
    if (!data.length) return;

    const now = new Date();
    const kafkaTopic = this.options.kafkaTopic ?? 'DATA_WAREHOUSE_INGEST_EVENTS';

    await this.kafkaProducer.send({
      topic: kafkaTopic,
      compression: this.options.compression ? CompressionTypes.ZSTD : undefined,
      messages: data.map((msg) => ({
        key: this.makeKafkaKey(msg),
        value: {
          dataJSON: jsonStringifyUnstable(msg.data),
          recordedAt: now,
          table: msg.table,
        },
      })),
    });
  }

  private makeKafkaKey(payload: any): any {
    if (payload.data?.org_id && payload.data?.item_creator_id) {
      return {
        orgId: payload.data.org_id,
        userId: payload.data.item_creator_id,
      };
    }

    return undefined;
  }
}
