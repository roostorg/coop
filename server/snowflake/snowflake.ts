import DataLoader from 'dataloader';
import { CompressionTypes } from 'kafkajs';

import { type KafkaSchemaMap } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import { type Kafka, type KafkaProducer } from '../kafka/index.js';
import { getFieldValueForRole } from '../services/itemProcessingService/index.js';
import { type ManualReviewToolServiceSnowflakeSchema } from '../services/manualReviewToolService/index.js';
import { type ReportingServiceSnowflakeSchema } from '../services/reportingService/index.js';
import { jsonParse, jsonStringifyUnstable } from '../utils/encoding.js';
import { assertUnreachable, sleep } from '../utils/misc.js';
import type SafeTracer from '../utils/SafeTracer.js';
import { type CollapseCases } from '../utils/typescript-types.js';
import {
  type BulkWriteTable,
  type BulkWriteType,
  type SnowflakePublicSchema,
} from './types.js';

/**
 * Type for Snowflake query function
 * Note: Services should use DataWarehouse from IOC container instead
 */
export type Snowflake = (
  query: string,
  tracer: SafeTracer,
  binds?: readonly unknown[],
) => Promise<unknown[]> & {
  start: () => void;
  close: () => Promise<void>;
  transaction: <T>(
    trx: (query: (query: string, binds?: unknown[]) => Promise<unknown[]>) => Promise<T>,
  ) => Promise<T>;
};

type BulkWrite<AcceptSlowQueries extends boolean> = {
  [K in BulkWriteTable]: {
    table: K;
    data: BulkWriteType<
      (SnowflakePublicSchema &
        ReportingServiceSnowflakeSchema &
        ManualReviewToolServiceSnowflakeSchema)[K],
      AcceptSlowQueries
    >;
  };
}[BulkWriteTable];

type BulkWriteT<
  T extends BulkWriteTable,
  AcceptSlowQueries extends boolean,
> = BulkWrite<AcceptSlowQueries> & { table: T };

/**
 * Factory for a service that'll write to snowflake _eventually_, after batching
 * the writes (currently using kafka as the 'buffer').
 */
function makeSnowflakeEventualWrite(
  kafka: Kafka<Pick<KafkaSchemaMap, 'DATA_WAREHOUSE_INGEST_EVENTS'>>,
) {
  const kafkaProducer = kafka.producer();
  const initialConnectPromise = kafkaProducer.connect();
  const batchTimeout = 1000;

  // This is totally abusing data loader to write data in batches, whereas it's
  // normally used for batched loading. But this should still work.
  const loader: DataLoader<BulkWrite<boolean>, void> = new DataLoader(
    async (data) =>
      bulkOutboxWrite(kafkaProducer, data).then(() =>
        new Array(data.length).fill(undefined),
      ),
    {
      cache: false,
      batch: true,
      maxBatchSize: 200,
      batchScheduleFn(cb) {
        setTimeout(cb, batchTimeout);
      },
    },
  );

  async function snowflakeEventualWrite<
    T extends BulkWriteTable,
    AcceptSlowQueries extends boolean = false,
  >(
    tableName: BulkWriteT<T, AcceptSlowQueries>['table'],
    rows: readonly BulkWriteT<T, AcceptSlowQueries>['data'][],
    skipBatch: boolean = false,
  ) {
    await initialConnectPromise;
    const dataToWrite = rows.map(
      (data) =>
        ({ table: tableName, data }) satisfies CollapseCases<
          BulkWriteT<BulkWriteTable, boolean>
        > as BulkWriteT<T, AcceptSlowQueries>,
    );

    if (skipBatch) {
      await bulkOutboxWrite(kafkaProducer, dataToWrite);
    } else {
      await loader.loadMany(dataToWrite);
    }
  }

  snowflakeEventualWrite.close = async () => {
    // make sure the latest batch of writes has been flushed to kafka before we
    // attempt to disconnect. This should be the last batch, assuming
    // snowflakeEventualWrite isn't called again after `close()` is called.
    // DataLoader doesn't have an API explicitly flushing this batch, which
    // makes sense given that we're really abusing DataLoader for this purpose,
    // so we just wait until the timer is up, with some buffer in case the event
    // loop is blocked or something.
    await sleep(batchTimeout + 1000);
    await kafkaProducer.disconnect();
  };

  return snowflakeEventualWrite;
}

// We have to declare this separately from makeSnowflakeEventualWrite
// to avoid an annoying circular dependency issue.
const makeSnowflakeEventualWriteWithDeps = inject(
  ['Kafka'],
  makeSnowflakeEventualWrite,
);

// But then we export it with the name snowflakeEventualWrite to match prior behavior.
export { makeSnowflakeEventualWriteWithDeps as makeSnowflakeEventualWrite };

async function bulkOutboxWrite(
  kafka: KafkaProducer<Pick<KafkaSchemaMap, 'DATA_WAREHOUSE_INGEST_EVENTS'>>,
  data: readonly BulkWrite<boolean>[],
) {
  if (!data.length) {
    return;
  }

  const now = new Date();
  await kafka.send({
    topic: 'DATA_WAREHOUSE_INGEST_EVENTS',
    compression: CompressionTypes.ZSTD,
    messages: data.map((msg) => ({
      key: makeKafkaKey(msg),
      value: {
        dataJSON: jsonStringifyUnstable(msg.data),
        recordedAt: now,
        table: msg.table,
      },
    })),
  });
}

// This is the key that's used for partitioning.
// eslint-disable-next-line complexity
function makeKafkaKey(
  msg: BulkWrite<boolean>,
): SnowflakeOutboxKafkaMessageKey | undefined {
  switch (msg.table) {
    case 'ITEM_MODEL_SCORES_LOG':
    case 'CONTENT_API_REQUESTS':
    case 'RULE_EXECUTIONS':
    case 'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS':
      return msg.data.item_creator_id
        ? { orgId: msg.data.org_id, userId: msg.data.item_creator_id }
        : undefined;
    case 'ACTION_EXECUTIONS':
      const userId = msg.data.item_submission_id
        ? msg.data.item_creator_id
        : msg.data.item_id;
      return userId ? { orgId: msg.data.org_id, userId } : undefined;
    case 'REPORTING_SERVICE.APPEALS':
      switch (msg.data.actioned_item_type_kind) {
        case 'USER':
          return { orgId: msg.data.org_id, userId: msg.data.actioned_item_id };
        case 'CONTENT':
          if (
            !('creatorId' in msg.data.actioned_item_type_schema_field_roles)
          ) {
            return undefined;
          }
          const userId = getFieldValueForRole(
            msg.data.actioned_item_type_schema,
            msg.data.actioned_item_type_schema_field_roles,
            'creatorId',
            msg.data.actioned_item_data,
          );
          return userId !== undefined
            ? { orgId: msg.data.org_id, userId: userId.id }
            : undefined;
        case 'THREAD':
          return undefined;
        default:
          assertUnreachable(msg.data.actioned_item_type_kind);
      }
    case 'REPORTING_SERVICE.REPORTS':
      switch (msg.data.reported_item_type_kind) {
        case 'USER':
          return { orgId: msg.data.org_id, userId: msg.data.reported_item_id };
        case 'CONTENT':
          if (
            !('creatorId' in msg.data.reported_item_type_schema_field_roles)
          ) {
            return undefined;
          }
          const userId = getFieldValueForRole(
            msg.data.reported_item_type_schema,
            msg.data.reported_item_type_schema_field_roles,
            'creatorId',
            msg.data.reported_item_data,
          );
          return userId !== undefined
            ? { orgId: msg.data.org_id, userId: userId.id }
            : undefined;
        case 'THREAD':
          return undefined;
        default:
          assertUnreachable(msg.data.reported_item_type_kind);
      }
    case 'REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS':
      switch (msg.data.item_type_kind) {
        case 'USER':
          return { orgId: msg.data.org_id, userId: msg.data.item_id };
        case 'CONTENT':
          if (!('creatorId' in msg.data.item_type_schema_field_roles)) {
            return undefined;
          }
          const userId = getFieldValueForRole(
            jsonParse(msg.data.item_type_schema),
            msg.data.item_type_schema_field_roles,
            'creatorId',
            jsonParse(msg.data.item_data),
          );
          return userId !== undefined
            ? { orgId: msg.data.org_id, userId: userId.id }
            : undefined;
        case 'THREAD':
          return undefined;
        default:
          assertUnreachable(msg.data.item_type_kind);
      }
    default:
      assertUnreachable(msg);
  }
}

export type SnowflakeEventualWrite = ReturnType<
  typeof makeSnowflakeEventualWrite
>;

// These types are used for the DATA_WAREHOUSE_INGEST_EVENTS Kafka topic
// They're defined here for Snowflake but could be reused by other warehouses
export type DataWarehouseOutboxKafkaMessageKey = {
  orgId: string;
  userId: string;
};

export type DataWarehouseOutboxKafkaMessageValue = {
  dataJSON: string;
  table: BulkWriteTable;
  recordedAt: Date;
};

// Deprecated: Use DataWarehouse* types instead
export type SnowflakeOutboxKafkaMessageKey = DataWarehouseOutboxKafkaMessageKey;
export type SnowflakeOutboxKafkaMessageValue = DataWarehouseOutboxKafkaMessageValue;
