import { BullModule, InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { type Job as BullJob, type Queue } from 'bullmq';

import {
  type Dependencies,
  type ItemSubmissionMessageValue,
} from '../../iocContainer/index.js';
import { ITEM_SUBMISSION_QUEUE_NAME } from '../../queues/itemSubmissionQueue.js';
import {
  submissionDataToItemSubmission,
  type ItemSubmission,
  type SubmissionId,
} from '../../services/itemProcessingService/index.js';
import { jsonParse } from '../../utils/encoding.js';
import { logErrorJson } from '../../utils/logging.js';
import { withRetries } from '../../utils/misc.js';
import { COOP_DEPS, InjectDeps } from '../tokens.js';

/**
 * Consumes item submissions from the BullMQ queue: stores each item in Scylla,
 * runs the org's enabled rules on it and logs the request.
 */
@Processor(ITEM_SUBMISSION_QUEUE_NAME, {
  concurrency: 30,
  removeOnComplete: { count: 0 },
  removeOnFail: { count: 1000 },
  // Started in onApplicationBootstrap, once Scylla is reachable.
  autorun: false,
})
export class ItemProcessingProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly tracer: Dependencies['Tracer'];
  private readonly meter: Dependencies['Meter'];
  private readonly ruleEngine: Dependencies['RuleEngine'];
  private readonly contentApiLogger: Dependencies['ContentApiLogger'];
  private readonly moderationConfigService: Dependencies['ModerationConfigService'];
  private readonly itemSubmissionRetryQueueBulkWrite: Dependencies['itemSubmissionRetryQueueBulkWrite'];
  private readonly insertWithRetries: Dependencies['ItemInvestigationService']['insertItem'];
  /** Resolves when the BullMQ worker has closed. */
  closed: Promise<void> | undefined;

  constructor(
    @InjectDeps() private readonly deps: Dependencies,
    @InjectQueue(ITEM_SUBMISSION_QUEUE_NAME)
    private readonly queue: Queue<ItemSubmissionMessageValue>,
  ) {
    super();
    this.tracer = deps.Tracer;
    this.meter = deps.Meter;
    this.ruleEngine = deps.RuleEngine;
    this.contentApiLogger = deps.ContentApiLogger;
    this.moderationConfigService = deps.ModerationConfigService;
    this.itemSubmissionRetryQueueBulkWrite =
      deps.itemSubmissionRetryQueueBulkWrite;
    const itemInvestigationService = deps.ItemInvestigationService;
    this.insertWithRetries = this.tracer.traced(
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
        itemInvestigationService.insertItem.bind(itemInvestigationService),
      ),
    );
  }

  async onApplicationBootstrap() {
    // Fail fast if Scylla is unreachable, instead of retry-looping per job.
    await this.deps.Scylla.connect();
    this.closed = new Promise<void>((resolve, reject) => {
      this.worker.on('closed', () => resolve());
      // run() settles when the worker closes; a rejection means the run loop
      // failed and the process should exit rather than sit idle.
      this.worker.run().catch((e: unknown) => {
        // eslint-disable-next-line no-restricted-syntax
        logErrorJson({ message: 'item-processing worker failed', error: e });
        reject(e instanceof Error ? e : new Error(String(e)));
      });
    });
    await this.worker.waitUntilReady();
  }

  async process(job: BullJob<ItemSubmissionMessageValue>) {
    const processJob = this.tracer.traced(
      {
        operation: 'processJob',
        resource: 'itemsProcessingWorker',
      },
      async () => {
        const jobStartTime = performance.now();
        const { itemSubmissionWithTypeIdentifier, metadata } = job.data;

        this.meter.itemProcessingAttemptsCounter.add(1, {
          process: 'item-processing-worker',
        });

        let itemSubmission;
        try {
          const { itemTypeIdentifier } = itemSubmissionWithTypeIdentifier;

          // BullMQ serializes job data as JSON, which converts Date
          // objects to ISO strings. Re-hydrate here.
          const submissionTime = new Date(
            itemSubmissionWithTypeIdentifier.submissionTime,
          );

          try {
            itemSubmission = (await submissionDataToItemSubmission(
              async ({ typeSelector, orgId }) =>
                this.moderationConfigService.getItemType({
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
                data: jsonParse(itemSubmissionWithTypeIdentifier.dataJSON),
                creatorId: null,
                creatorTypeId: null,
              },
            )) as ItemSubmission & { submissionTime: Date };
          } catch {
            // If we can't reconstruct a message, it likely has
            // bad data or was written in a bad format. Write to
            // the DLQ for inspection and return without throwing
            // so BullMQ marks this job as complete (not retried).
            await this.itemSubmissionRetryQueueBulkWrite([job.data]);
            return;
          }

          try {
            await this.insertWithRetries({
              requestId: metadata.requestId,
              orgId: metadata.orgId,
              itemSubmission,
            });
          } catch (e: unknown) {
            // swallow error for now if an item fails to make it into
            // scylla; it shouldn't prevent processing
          }

          await this.ruleEngine.runEnabledRules(
            itemSubmission,
            metadata.requestId,
          );

          await this.contentApiLogger.logContentApiRequest(
            {
              requestId: metadata.requestId,
              orgId: metadata.orgId,
              itemSubmission,
              failureReason: undefined,
            },
            false,
          );

          this.meter.itemProcessingJobTime.record(
            performance.now() - jobStartTime,
          );

          this.queue
            .getJobCounts('waiting', 'active')
            .then((counts) => {
              this.meter.itemProcessingQueueDepth.record(
                counts.waiting + counts.active,
              );
            })
            .catch(() => {});
        } catch (e: unknown) {
          this.tracer.logActiveSpanFailedIfAny(e);
          this.meter.itemProcessingFailuresCounter.add(1, {
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
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [COOP_DEPS],
      useFactory: (deps: Dependencies) => ({ connection: deps.IORedis }),
    }),
    BullModule.registerQueue({ name: ITEM_SUBMISSION_QUEUE_NAME }),
  ],
  providers: [ItemProcessingProcessor],
})
export class ItemProcessingModule {}
