import { Queue } from 'bullmq';
import DataLoader from 'dataloader';
import type IORedis from 'ioredis';
import { type Cluster } from 'ioredis';

import { type ItemSubmissionMessageValue } from '../iocContainer/index.js';
import { sleep } from '../utils/misc.js';

export const ITEM_SUBMISSION_QUEUE_NAME = 'item-submission';
export const ITEM_SUBMISSION_DLQ_NAME = 'item-submission-dlq';

type RedisConnection = IORedis.Redis | Cluster;

/**
 * Factory for a service that writes item submissions to BullMQ after batching,
 * returning to the caller after the whole batch has been enqueued.
 */
function makeItemSubmissionBulkWrite(
  redis: RedisConnection,
  queueName: string,
) {
  const queue = new Queue(queueName, { connection: redis });

  const batchTimeout = 500;

  const loader: DataLoader<ItemSubmissionMessageValue, void> = new DataLoader(
    async (data) =>
      bulkWrite(queue, data).then(() =>
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

  async function itemSubmissionBulkWrite(
    items: readonly ItemSubmissionMessageValue[],
    skipBatch: boolean = false,
  ) {
    if (skipBatch) {
      try {
        await bulkWrite(queue, items);
        return { error: false, results: [] };
      } catch (err) {
        return { error: true, results: [err] };
      }
    } else {
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

  itemSubmissionBulkWrite.close = async () => {
    await sleep(batchTimeout + 1000);
    await queue.close();
  };

  return itemSubmissionBulkWrite;
}

export type ItemSubmissionBulkWrite = ReturnType<
  typeof makeItemSubmissionBulkWrite
>;

export { makeItemSubmissionBulkWrite };

async function bulkWrite(
  queue: Queue<ItemSubmissionMessageValue>,
  data: readonly ItemSubmissionMessageValue[],
) {
  if (!data.length) {
    return;
  }

  await queue.addBulk(
    data.map((msg) => ({
      name: 'item-submission',
      data: msg,
    })),
  );
}
