import DataLoader from 'dataloader';
import { CompressionTypes } from 'kafkajs';

import {
  type ItemSubmissionKafkaMessageValue,
  type KafkaSchemaMap,
} from '../iocContainer/index.js';
import { type Kafka, type KafkaProducer } from '../kafka/index.js';
import { sleep } from '../utils/misc.js';

type ITEM_SUBMISSION_SCHEMAS =
  | 'ITEM_SUBMISSION_EVENTS'
  | 'ITEM_SUBMISSION_EVENTS_RETRY_0';

/**
 * Factory for a service that'll write to Kafka after batching the writes,
 * returns to the caller after the whole batch has been written.
 */
function makeItemQueueBulkWrite(
  kafka: Kafka<Pick<KafkaSchemaMap, ITEM_SUBMISSION_SCHEMAS>>,
  topic: ITEM_SUBMISSION_SCHEMAS,
) {
  const kafkaProducer = kafka.producer();
  const initialConnectPromise = kafkaProducer.connect();
  const batchTimeout = 500;

  const loader: DataLoader<ItemSubmissionKafkaMessageValue, void> =
    new DataLoader(
      async (data) =>
        bulkWrite(kafkaProducer, data, topic).then(() =>
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

  async function itemQueueBulkWrite(
    items: readonly ItemSubmissionKafkaMessageValue[],
    skipBatch: boolean = false,
  ) {
    await initialConnectPromise;
    // bulkWrite and loader.loadMany have different return types, so we have to
    // handle their returns separately and construct a homogenous return type in
    // each case, in addition to the logical difference of using batching or not
    if (skipBatch) {
      try {
        await bulkWrite(kafkaProducer, items, topic);
        return { error: false, results: [] };
      } catch (err) {
        return { error: true, results: [err] };
      }
    } else {
      // loader.loadMany never throws, just return error objects in it's
      // response
      const response = await loader.loadMany(items);
      if (response.some((r) => r instanceof Error)) {
        return {
          error: true,
          results: response,
        };
      }
      return {
        error: false,
        results: [],
      };
    }
  }

  itemQueueBulkWrite.close = async () => {
    // make sure the latest batch of writes has been flushed to kafka before we
    // attempt to disconnect. This should be the last batch, assuming
    // bulkWrite isn't called again after `close()` is called.
    await sleep(batchTimeout + 1000);
    await kafkaProducer.disconnect();
  };

  return itemQueueBulkWrite;
}

export type ItemQueueBulkWrite = ReturnType<typeof makeItemQueueBulkWrite>;

export { makeItemQueueBulkWrite };

async function bulkWrite(
  kafka: KafkaProducer<Pick<KafkaSchemaMap, ITEM_SUBMISSION_SCHEMAS>>,
  data: readonly ItemSubmissionKafkaMessageValue[],
  topic: ITEM_SUBMISSION_SCHEMAS,
) {
  if (!data.length) {
    return;
  }

  await kafka.send({
    topic,
    compression: CompressionTypes.ZSTD,
    messages: data.map((msg) => ({
      key: {
        syntheticThreadId: msg.metadata.syntheticThreadId,
      },
      value: msg,
    })),
  });
}
