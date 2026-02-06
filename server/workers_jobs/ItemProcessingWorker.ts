
import { type KafkaSchemaMap } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import { type Kafka, type KafkaConsumerRunConfig } from '../kafka/index.js';
import {
  submissionDataToItemSubmission,
  type ItemSubmission,
  type SubmissionId,
} from '../services/itemProcessingService/index.js';
import { jsonParse } from '../utils/encoding.js';
import { withRetries } from '../utils/misc.js';
import { type Worker } from './index.js';

const topicsToConsume = ['ITEM_SUBMISSION_EVENTS'] as const;

type ConsumedTopic = (typeof topicsToConsume)[number];

export default inject(
  [
    'Kafka',
    'Tracer',
    'RuleEngine',
    'ContentApiLogger',
    'ModerationConfigService',
    'ItemInvestigationService',
    'Meter',
    'itemSubmissionRetryQueueBulkWrite',
  ],
  (
    kafka: Kafka<Pick<KafkaSchemaMap, ConsumedTopic>>,
    tracer,
    ruleEngine,
    contentApiLogger,
    moderationConfigService,
    ItemInvestigationService,
    Meter,
    itemSubmissionRetryQueueBulkWrite,
  ) => {
    let consumer: ReturnType<typeof kafka.consumer<ConsumedTopic>>;

    return {
      type: 'Worker' as const,
      async run(_signal) {
        consumer = kafka.consumer<ConsumedTopic>({
          // NB: don't rename lightly, as this has permissions
          // associated w/ it through Kafka ACLS.
          groupId: 'item-submission-worker',
          maxBytesPerPartition: 1024 * 1024, // 1 mb = Default
          sessionTimeout: 90_000,
        });

        await consumer.connect();
        await consumer.subscribe({ topics: topicsToConsume });

        // An error thrown within eachBatch does not lead the promise returned
        // by `consumer.run()` to reject. Instead, that promise resolves
        // immediately once the consumer starts running and, if an error occurs
        // within `eachBatch`, kafkajs will simply retry the `eachBatch`
        // callback a few times (the exact number is configurable). However,
        // _even once that retry count limit is exhausted_, the `consumer.run()`
        // call still does not reject, as you might expect.
        //
        // Instead, once that retry count is exhausted, kafkajs switches from
        // silently + automatically retrying `eachBatch` to emitting a `crash`
        // event on the consumer. However, even after this `crash` event is
        // emitted, kafkajs does not stop the consumer or raise an exception.
        // Instead, kafkajs's default behavior is to simply restart the consumer
        // after the crash event. So the overall nodejs process will, by
        // default, basically never crash.
        //
        // However, for now, we _want_ Node to crash if we're getting repeated
        // errors (even after retrying) within `eachBatch`, so that we can take
        // advantage of simple, out-of-the-box monitoring to see these crashes.
        // Therefore, we register a crash listener that throws unconditionally
        // (again, this only applies once the automatic retries have failed and
        // the crash event is emitted). The unconditional part means that we're
        // ignoring `event.payload.restart`, which is the flag for whether
        // kafkajs should restart the consumer after the crash, and which is
        // always true by default. Kafkajs takes a `retryOnFailure` setting for
        // configuring that, but we don't even bother, because we always want to
        // crash nodejs/the whole process once the consumer crash event is
        // emitted.
        consumer.on('consumer.crash', (event) => {
          const { error } = event.payload;
          tracer.logActiveSpanFailedIfAny(error);
          throw error;
        });

        // Error Cases
        //
        // 1. If the worker is shut down by kubernetes (eg. a new version is
        //    deployed and being rolled out, or because k8s decides this pod needs
        //    to be evicted/moved to another node), then shutdown() will run,
        //    which will call `consumer.disconnect()`, which also makes the
        //    consumer stop pulling new messages, so there's nothing else we have
        //    to do. If a batch is interrupted by shutdown, KafkaJS will
        //    automatically commit any resolved offsets so that we don’t lose
        //    progress another worker doesn’t re-process messages that this worker
        //    has already seen, while the rest of the batches messages should be
        //    picked up by another worker and processed eventually.
        //
        // 2. If Kafka is unavailable when the worker starts, then the consumer
        //    will fail to connect or subscribe, the worker will throw an
        //    exception (after some internal kafkajs retrying), no state will get
        //    messed up, and k8s can restart the worker.
        //
        // 3. If Kafka becomes unavailable while the worker is running,
        //    there are two cases:
        //    a) KafkaJS detects that Kafka is unavailable when it tries to
        //       fetch the next batch. By default kafkajs will try to reconnect
        //       for a while; if that fails, I think an error is eventually
        //       raised (either thrown or as the "CRASH" event), in which case
        //       there shouldn’t be any buffered messages (because we only
        //       request a new batch when the current one is completely finished
        //       processing and the offset is committed) so when Kafka becomes
        //       available again we should be able to start making progress with
        //       no weird state.
        //    b) kafkajs detects that kafka is unavailable when it tries to
        //       commit the offsets, _after processing items and publishing
        //       actions_. Kafkajs will already retry committing the offsets
        //       but, if that fails, what do we do? If we shut down the worker,
        //       the consumer will restart and reprocess the messages that
        //       didn’t get their offsets committed. It is not a catastrophic
        //       failure if one batch of messages is re-processed when there is
        //       a connection issue with kafka, so this worker does not have
        //       logic to prevent this situation. The main issue with this
        //       failure is we may publish actions for those items more than
        //       once, which again is not catastrophic but also not ideal. To
        //       prevent this we can add an idempotency mechanism to the action
        //       publisher that stores a key of either `topic:partition:offset`
        //       or `requestId:SubmissionId` for each action with some
        //       reasonable TTL, and also checks for that keys existence before
        //       sending a request to a custom action callback API.
        //
        //  4. If a partition gets reassigned while a batch is in the middle of
        //     processing,kafkaJS will automatically commit the resolved offsets
        //     for the current batch, similar to case 1.
        //
        //  5. If the item processing  takes a long time (which is very
        //     possible since much of the rule engine is network I/O), we want to
        //     make sure that Kafka doesn't think the consumer is dead and
        //     needlessly reassign its partitions. So, we set a 5 second heartbeat
        //     interval outside of KafkaJS’s automatic heartbeat flow.
        //
        //  6. An error is thrown while processing a message. This can happen
        //     if any one of `itemDataToItemSubmission`, `runEnabledRules`, or
        //     `logContentAPIRequest` throws. In all these cases we choose to
        //     block the queue (or at least the current partition) from
        //     progressing until the error is resolved, for the reasons explained
        //     below:
        //     a) `itemDataToItemSubmission` throws. This could happen if there
        //         is an issue connecting to postgres, in which case we should retry
        //         until it succeeds (this can be handled by simply throwing and
        //         causing the batch to retry). If  data is fundamentally malformed
        //         and will always cause this error to throw, this is likely
        //         due to a bug in the Kafka producer code, or somehow bad data
        //         got through validation and is not reconstructible. In this
        //         case we write to a separate queue to allow processing of
        //         other messages to continue, and these bad messages can be
        //         inspected from the dead letter queue
        //
        //    b)  `runEnabledRules` throws. This does not happen in the usual
        //        lifecycle of our application, even if all signals associated with
        //        a given rule fail. This usually happens when we push a bug or bad
        //        code, or if some other infrastructure is down (e.g. postgres). In
        //        this case we want to block progress until the external dependency
        //        is back up or we deploy a fix for the bug. This ensures that all
        //        items are processed normally when the issue is resolved.
        //
        //    c)  `logContentAPIRequest` throws. This will happen if a
        //         connection to kafka is unavailable, in which case we generally
        //         can’t make progress, or if this function throws. This is likely
        //         to be a transient error and we can throw this error, causing the
        //         batch to be retried. Although this is the same strategy as 6.a
        //         and 6.b, in this case we have already processed the given item
        //         and may have published actions related to it so we risk
        //         publishing actions more than once (as well as doing duplicate
        //         work more generally). This can be mitigated with the same
        //         idempotency strategy described in 3.b, and again we don’t take
        //         pains to prevent duplicate work in this case in the code for this
        //         worker.

        const eachBatchTraced = tracer.traced(
          { operation: 'processBatch', resource: 'itemsProcessingWorker' },
          async function ({ batch, heartbeat }) {
            // Heartbeat every 5s while the upload is in progress/being retried
            // (kafkajs will dedupe these if we're calling heartbeat more often
            // than heartbeat interval), to avoid 30s session timeout if s3
            // upload has to be retried a few times or takes a long time.
            // Handles case (6) above.
            const heartbeatInverval = setInterval(() => {
              heartbeat().catch((reason) => {
                tracer.traced(
                  {
                    operation: 'consumerHeartbeat',
                    resource: 'itemsProcessingWorker',
                  },
                  () => {
                    tracer.logActiveSpanFailedIfAny(reason);
                  },
                );
              });
            }, 5_000);

            try {
              const { decodedMessages: messages, topic, partition } = batch;
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
                  ItemInvestigationService.insertItem.bind(
                    ItemInvestigationService,
                  ),
                ),
              );

              Meter.itemProcessingBatchSize.record(messages.length);
              const batchStartTime = performance.now();
              await Promise.all(
                messages.map(async (data) => {
                  // TODO: what to do if value is missing cuz we wrote incorrectly?
                  // Add metric to count occurences of this, ideally we would only see this
                  // failure on first deploy and quickly fix it.
                  const { itemSubmissionWithTypeIdentifier, metadata } =
                    data.value!;

                  Meter.itemProcessingAttemptsCounter.add(1, {
                    process: 'item-processing-worker',
                  });

                  // TODO: better way to do this?
                  let itemSubmission;
                  try {
                    const { itemTypeIdentifier } =
                      itemSubmissionWithTypeIdentifier;

                    try {
                      // NB: could throw if item type can't be found (e.g.,
                      // postgres briefly down)
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
                          submissionTime:
                            itemSubmissionWithTypeIdentifier.submissionTime,
                          itemId: itemSubmissionWithTypeIdentifier.itemId,
                          itemTypeId: itemTypeIdentifier.id,
                          itemTypeVersion: itemTypeIdentifier.version,
                          itemTypeSchemaVariant:
                            itemTypeIdentifier.schemaVariant,
                          data: jsonParse(
                            itemSubmissionWithTypeIdentifier.dataJSON,
                          ),
                          creatorId: null,
                          creatorTypeId: null,
                        },
                        // this cast is safe since new ItemSubmissions are
                        // always written with a submissionTime, despite the
                        // `...toItemSubmission` function annotation implying they
                        // could have an undefined submissionTime. This is to support
                        // legacy submissions, but none of those will end up in
                        // Kafka
                      )) as ItemSubmission & { submissionTime: Date };
                    } catch {
                      // If we can't reconstruct a message, it is likely has
                      // made it past validation with some bad data (shouldn't happen)
                      // or the kafka message was written in a bad format. In this case
                      // we hope it is not a problem with every single item, so we don't want
                      // to block progress on the item submission queue - so we write to a
                      // retry queue which can be inspected and optionally retried
                      if (data.value) {
                        await itemSubmissionRetryQueueBulkWrite([data.value]);
                      }
                      return;
                    }

                    try {
                      await insertWithRetries({
                        requestId: metadata.requestId,
                        orgId: metadata.orgId,
                        itemSubmission,
                      });
                    } catch (e: unknown) {
                      //swallow error for now if an item fails to make it into
                      //scylla, it is not really an issue for running most
                      //rules and shouldn't prevent processing
                    }

                    await ruleEngine.runEnabledRules(
                      itemSubmission,
                      metadata.requestId,
                    );

                    // This returns as soon as the item is loaded, not when the
                    // batch is actually written, so it can be
                    // safely/efficiently awaited on each message
                    await contentApiLogger.logContentApiRequest(
                      {
                        requestId: metadata.requestId,
                        orgId: metadata.orgId,
                        itemSubmission,
                        failureReason: undefined,
                      },
                      false,
                    );

                  } catch (e: unknown) {
                    tracer.logActiveSpanFailedIfAny(e);
                    Meter.itemProcessingFailuresCounter.add(1, {
                      process: 'item-processing-worker',
                    });

                    // When we reach this catch block we have hit one of the errors in
                    // case 6 a, b, or c. These fall into two categories:
                    //
                    // Transient Errors: errors in connection to postgres, or
                    // writing to ContentAPIRequests. these are cheaply retried
                    // by throwing, which triggers another call to `eachBatch`.
                    //
                    // Bugs or Infrastructure outages: In these cases we want
                    // to stop progressing through the queue until the issue is
                    // resolved, either by deploying updated code which fixes
                    // the issue, or when some external infrastructure (most
                    // likely Kafka itself) is available and we can establish a
                    // connection. We can also handle this by throwing, which
                    // will retry continually until the process crashes.
                    //
                    // In both cases (if Kafka is available) KafkaJS will
                    // automatically commit the offsets for any messages in the
                    // batch that have already been processed, so we are not at
                    // risk of re-processing them and duplicating effor
                    throw e;
                  }
                }),
              );
              Meter.itemProcessingBatchTime.record(
                performance.now() - batchStartTime,
              );

              // commit offset only after processing successfully. The +1 here
              // _is_ necessary, after extensive testing, because kafka starts
              // consuming at the committed offset so, if we commit the last
              // offset that was successfully processed, and then the worker
              // restarts or there's a rebalance, that message will get
              // processed twice. We use BigInt here since the offset is
              // uint64.
              await consumer.commitOffsets([
                {
                  topic,
                  partition,
                  offset: (BigInt(batch.lastOffset()) + 1n).toString(),
                },
              ]);

              // NB: no catch block means the error's rethrown, which addresses
              // Error cases 6 a, b, c
              // This will trigger eachBatch to be retried, until the process
              // eventually crashes. See comment on the crash listener.
            } finally {
              clearInterval(heartbeatInverval);
            }
          } satisfies KafkaConsumerRunConfig<
            Pick<KafkaSchemaMap, ConsumedTopic>
          >['eachBatch'],
        );

        await consumer.run({
          autoCommit: false,
          partitionsConsumedConcurrently: 30,
          eachBatch: eachBatchTraced,
        });
      },
      async shutdown() {
        await consumer.disconnect();
      },
    } satisfies Worker;
  },
);
