
import { Queue, Worker as BullWorker, type Job as BullJob } from 'bullmq';
import { type Cluster } from 'ioredis';
import type IORedis from 'ioredis';

import { type ItemSubmissionMessageValue } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import { ITEM_SUBMISSION_QUEUE_NAME } from '../queues/itemSubmissionQueue.js';
import {
  submissionDataToItemSubmission,
  type ItemSubmission,
  type SubmissionId,
} from '../services/itemProcessingService/index.js';
import { jsonParse } from '../utils/encoding.js';
import { withRetries } from '../utils/misc.js';
import { type Worker } from './index.js';

export default inject(
  [
    'IORedis',
    'Tracer',
    'RuleEngine',
    'ContentApiLogger',
    'ModerationConfigService',
    'ItemInvestigationService',
    'Meter',
    'itemSubmissionRetryQueueBulkWrite',
  ],
  (
    redis: IORedis.Redis | Cluster,
    tracer,
    ruleEngine,
    contentApiLogger,
    moderationConfigService,
    ItemInvestigationService,
    Meter,
    itemSubmissionRetryQueueBulkWrite,
  ) => {
    let worker: BullWorker<ItemSubmissionMessageValue> | undefined;
    let queue: Queue<ItemSubmissionMessageValue> | undefined;

    return {
      type: 'Worker' as const,
      async run(_signal) {
        queue = new Queue(ITEM_SUBMISSION_QUEUE_NAME, { connection: redis });
        const insertWithRetries = tracer.traced(
          {
            resource: 'itemProcessingWorker',
            operation: 'ItemInvestigationService.insertItem',
          },
          withRetries(
            {
              maxRetries: 1,
              initialTimeMsBetweenRetries: 75,
              maxTimeMsBetweenRetries: 250,
            },
            ItemInvestigationService.insertItem.bind(ItemInvestigationService),
          ),
        );

        worker = new BullWorker<ItemSubmissionMessageValue>(
          ITEM_SUBMISSION_QUEUE_NAME,
          async (job: BullJob<ItemSubmissionMessageValue>) => {
            const processJob = tracer.traced(
              {
                operation: 'processJob',
                resource: 'itemsProcessingWorker',
              },
              async () => {
                const jobStartTime = performance.now();
                const { itemSubmissionWithTypeIdentifier, metadata } = job.data;

                Meter.itemProcessingAttemptsCounter.add(1, {
                  process: 'item-processing-worker',
                });

                let itemSubmission;
                try {
                  const { itemTypeIdentifier } =
                    itemSubmissionWithTypeIdentifier;

                  // BullMQ serializes job data as JSON, which converts Date
                  // objects to ISO strings. Re-hydrate here.
                  const submissionTime = new Date(
                    itemSubmissionWithTypeIdentifier.submissionTime,
                  );

                  try {
                    itemSubmission = (await submissionDataToItemSubmission(
                      async ({ typeSelector, orgId }) =>
                        moderationConfigService.getItemType({
                          orgId,
                          itemTypeSelector: typeSelector,
                        }),
                      {
                        orgId: metadata.orgId,
                        submissionId:
                          itemSubmissionWithTypeIdentifier.submissionId satisfies string as SubmissionId,
                        submissionTime,
                        itemId: itemSubmissionWithTypeIdentifier.itemId,
                        itemTypeId: itemTypeIdentifier.id,
                        itemTypeVersion: itemTypeIdentifier.version,
                        itemTypeSchemaVariant: itemTypeIdentifier.schemaVariant,
                        data: jsonParse(
                          itemSubmissionWithTypeIdentifier.dataJSON,
                        ),
                        creatorId: null,
                        creatorTypeId: null,
                      },
                    )) as ItemSubmission & { submissionTime: Date };
                  } catch {
                    // If we can't reconstruct a message, it likely has
                    // bad data or was written in a bad format. Write to
                    // the DLQ for inspection and return without throwing
                    // so BullMQ marks this job as complete (not retried).
                    await itemSubmissionRetryQueueBulkWrite([job.data]);
                    return;
                  }

                  try {
                    await insertWithRetries({
                      requestId: metadata.requestId,
                      orgId: metadata.orgId,
                      itemSubmission,
                    });
                  } catch (e: unknown) {
                    // swallow error for now if an item fails to make it into
                    // scylla; it shouldn't prevent processing
                  }

                  await ruleEngine.runEnabledRules(
                    itemSubmission,
                    metadata.requestId,
                  );

                  await contentApiLogger.logContentApiRequest(
                    {
                      requestId: metadata.requestId,
                      orgId: metadata.orgId,
                      itemSubmission,
                      failureReason: undefined,
                    },
                    false,
                  );

                  Meter.itemProcessingJobTime.record(
                    performance.now() - jobStartTime,
                  );

                  queue!.getJobCounts('waiting', 'active').then((counts) => {
                    Meter.itemProcessingQueueDepth.record(
                      counts.waiting + counts.active,
                    );
                  }).catch(() => {});
                } catch (e: unknown) {
                  tracer.logActiveSpanFailedIfAny(e);
                  Meter.itemProcessingFailuresCounter.add(1, {
                    process: 'item-processing-worker',
                  });

                  // Transient errors (postgres down, etc.) are retried by
                  // BullMQ automatically. Bugs or infrastructure outages
                  // will exhaust retries and the job moves to failed state,
                  // preserving it for inspection.
                  throw e;
                }
              },
            );

            await processJob();
          },
          {
            connection: redis,
            concurrency: 30,
            removeOnComplete: { count: 0 },
            removeOnFail: { count: 1000 },
          },
        );

        // BullMQ Worker runs continuously; wait for it to be ready
        await worker.waitUntilReady();

        // Keep the run() promise pending until the worker is closed.
        await new Promise<void>((resolve) => {
          worker!.on('closed', () => resolve());
        });
      },
      async shutdown() {
        await worker?.close();
        await queue?.close();
      },
    } satisfies Worker;
  },
);
