import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { type Cluster } from 'ioredis';

import { jsonStringify } from '../utils/encoding.js';
import { logErrorJson } from '../utils/logging.js';

export const REPORTED_MEDIA_BANKING_QUEUE_NAME = 'reported-media-banking';

/** One media item of an accepted NCMEC report, to be added to the org's hash
 * bank. One job per item, so a failure retries only that item. */
export type ReportedMediaBankingJobData = {
  orgId: string;
  hashBankId: number;
  ncmecReportId: string;
  itemId: string;
  itemTypeId: string;
  url: string;
};

/** The enqueue call, without the queue lifecycle the container owns. */
export type ReportedMediaBankingEnqueueFn = (
  jobs: readonly ReportedMediaBankingJobData[],
) => Promise<void>;

type RedisConnection = IORedis.Redis | Cluster;

/** Factory for the function that enqueues reported media for banking. */
function makeReportedMediaBankingEnqueue(redis: RedisConnection) {
  let queue: Queue<ReportedMediaBankingJobData> | undefined;

  // Built on first use: creating it opens a Redis connection, and most
  // processes that depend on this service never enqueue anything.
  function getQueue() {
    if (queue === undefined) {
      queue = new Queue<ReportedMediaBankingJobData>(
        REPORTED_MEDIA_BANKING_QUEUE_NAME,
        { connection: redis },
      );
      // BullMQ re-emits Redis connection errors, and an 'error' event with no
      // listener takes the process down. Enqueue failures still reject below.
      queue.on('error', (error) => {
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({
          error,
          message: jsonStringify({
            event: 'reportedMediaBankingQueueError',
            queue: REPORTED_MEDIA_BANKING_QUEUE_NAME,
          }),
        });
      });
    }
    return queue;
  }

  async function reportedMediaBankingEnqueue(
    jobs: readonly ReportedMediaBankingJobData[],
  ) {
    if (jobs.length === 0) {
      return;
    }
    await getQueue().addBulk(
      jobs.map((data) => ({
        name: REPORTED_MEDIA_BANKING_QUEUE_NAME,
        data,
        opts: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 0 },
          removeOnFail: { count: 1000 },
        },
      })),
    );
  }

  reportedMediaBankingEnqueue.close = async () => {
    await queue?.close();
  };

  return reportedMediaBankingEnqueue;
}

export type ReportedMediaBankingEnqueue = ReturnType<
  typeof makeReportedMediaBankingEnqueue
>;

export { makeReportedMediaBankingEnqueue };
