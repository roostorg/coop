import {
  Worker as BullWorker,
  UnrecoverableError,
  type Job as BullJob,
} from 'bullmq';
import type IORedis from 'ioredis';
import { type Cluster } from 'ioredis';

import { inject } from '../iocContainer/utils.js';
import {
  REPORTED_MEDIA_BANKING_QUEUE_NAME,
  type ReportedMediaBankingJobData,
} from '../queues/reportedMediaBankingQueue.js';
import { type HmaService } from '../services/hmaService/index.js';
import { jsonStringify } from '../utils/encoding.js';
import { logErrorJson } from '../utils/logging.js';
import { type Worker } from './index.js';

export interface ReportedMediaBankingDeps {
  hmaService: Pick<HmaService, 'getBankById' | 'addContentToBank'>;
}

/** Adds one media item of an accepted NCMEC report to the org's hash bank.
 * Throwing hands the retry to BullMQ; `UnrecoverableError` stops retrying a
 * job that cannot succeed, such as a bank that no longer exists. */
export async function bankReportedMedia(
  deps: ReportedMediaBankingDeps,
  data: ReportedMediaBankingJobData,
): Promise<void> {
  const { orgId, hashBankId, ncmecReportId, itemId, itemTypeId, url } = data;
  const bank = await deps.hmaService.getBankById(orgId, hashBankId);

  if (bank == null) {
    throw new UnrecoverableError(
      `Hash bank ${hashBankId} no longer exists for org ${orgId}`,
    );
  }

  await deps.hmaService.addContentToBank(bank.hma_name, {
    url,
    metadata: {
      content_id: `${itemTypeId}:${itemId}`,
      json: {
        source: 'ncmec_report',
        orgId,
        ncmecReportId,
        itemId,
        itemTypeId,
      },
    },
  });
}

export default inject(
  ['IORedis', 'Tracer', 'HMAHashBankService'],
  (redis: IORedis.Redis | Cluster, tracer, hmaService) => {
    let worker: BullWorker<ReportedMediaBankingJobData> | undefined;

    return {
      type: 'Worker' as const,
      async run(_signal) {
        const bankingWorker = new BullWorker<ReportedMediaBankingJobData>(
          REPORTED_MEDIA_BANKING_QUEUE_NAME,
          async (job: BullJob<ReportedMediaBankingJobData>) => {
            const processJob = tracer.traced(
              {
                operation: 'processJob',
                resource: 'reportedMediaBankingWorker',
              },
              async () => bankReportedMedia({ hmaService }, job.data),
            );

            await processJob();
          },
          {
            connection: redis,
            concurrency: 5,
            removeOnComplete: { count: 0 },
            removeOnFail: { count: 1000 },
          },
        );
        worker = bankingWorker;

        // An 'error' event with no listener takes the process down, which
        // would stop banking until the worker is restarted.
        bankingWorker.on('error', (error) => {
          // eslint-disable-next-line no-restricted-syntax
          logErrorJson({
            error,
            message: jsonStringify({
              event: 'reportedMediaBankingWorkerError',
              queue: REPORTED_MEDIA_BANKING_QUEUE_NAME,
            }),
          });
        });

        await bankingWorker.waitUntilReady();

        await new Promise<void>((resolve) => {
          bankingWorker.on('closed', () => resolve());
        });
      },
      async shutdown() {
        await worker?.close();
      },
    } satisfies Worker;
  },
);
