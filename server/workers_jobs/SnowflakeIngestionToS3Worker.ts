import { compress } from '@mongodb-js/zstd';
import lodash from 'lodash';

import { type KafkaSchemaMap } from '../iocContainer/index.js';
import { inject } from '../iocContainer/utils.js';
import { type DecodedMessage } from '../kafka/index.js';
import { type S3StoreObject } from '../services/s3StoreObject.js';
import { type SnowflakeOutboxKafkaMessageValue } from '../snowflake/snowflake.js';
import { b64UrlEncode, jsonStringify, type JsonOf } from '../utils/encoding.js';
import { pad } from '../utils/misc.js';
import { getUtcParts } from '../utils/time.js';
import { type NonEmptyArray } from '../utils/typescript-types.js';
import { type Worker } from './index.js';

const { SNOWFLAKE_S3_BUCKET_REGION, SNOWFLAKE_S3_BUCKET_NAME } = process.env;
const { mapValues } = lodash;

// NB: If we add more topics to this subscription, we'll have to think
// about the deployment/rollout considerations there.
// See https://github.com/tulios/kafkajs/issues/1040#issuecomment-1277449487
const topicsToConsume = ['DATA_WAREHOUSE_INGEST_EVENTS'] as const;

type ConsumedTopic = (typeof topicsToConsume)[number];
type Message = DecodedMessage<Pick<KafkaSchemaMap, ConsumedTopic>>;

type PartitionGuid = JsonOf<readonly [topic: ConsumedTopic, partition: number]>;

export default inject(
  ['Kafka', 'S3StoreObjectFactory', 'Tracer'],
  (kafka, storeObjectFactory, tracer) => {
    // TODO: unfortunately, this needs to be in this outer scope as a mutable
    // variable to support shutdown.
    let consumer: ReturnType<typeof kafka.consumer<ConsumedTopic>>;

    return {
      type: 'Worker' as const,
      async run(_signal) {
        const s3StoreObject = storeObjectFactory(
          SNOWFLAKE_S3_BUCKET_REGION!,
          SNOWFLAKE_S3_BUCKET_NAME!,
        );

        consumer = kafka.consumer<ConsumedTopic>({
          // NB: don't rename lightly, as this has permissions
          // associated w/ it through Kafka ACLS.
          groupId: 'snowflake-ingest-worker',
          maxBytesPerPartition: 20 * 1024 * 1024, // 20 mb
          sessionTimeout: 90_000,
        });

        const unuploadedMessagesByPartition = new Map<
          PartitionGuid,
          Map<string, Exclude<Message['value'], null>>
        >();

        // Let's talk about error cases....
        //
        // 1. If the worker is shut down by kubernetes (eg. cuz a new version is
        //    deployed and being rolled out, or because k8s otherwise decides
        //    this pod needs to be evicted/moved to another node), then
        //    shutdown() will run, which will call `consumer.disconnect()`,
        //    which also makes the consumer stop pulling new messages, so
        //    there's nothing else we have to do. Messages already loaded into
        //    memory don't need to be uploaded to s3 because their offset won't
        //    be committed, so we'll just re-process them next time. If an
        //    upload's in progress, I think it's ok to let it try to finish
        //    (even with retries) as that shouldn't take too long, and if k8s
        //    ends up killing the process ungracefully, it's not a huge deal.
        //
        //    While this consumer is restarting, the other consumers will get
        //    assigned its partitions, so we have to make sure they can handle
        //    the extra memory load of having more batches worth of data, and
        //    that they react correctly to the new partition assignment.
        //
        // 2. Uploading to S3 could fail. If that happens, we can't really
        //    proceed, so we probably want to retry for a while and then crash.
        //    (We crash so that monitoring systems can alert on the failure.)
        //    Again, no state gets messed up in this case, since we haven't
        //    advanced the Kafka offsets.
        //
        // 3. If Kafka is unavailable when the worker starts, then the consumer
        //    will fail to connect or subscribe, the worker will throw an
        //    exception (after some internal kafkajs retrying), no state will
        //    get messed up, and k8s can restart the worker.
        //
        // 4. If Kafka becomes unavailable while the worker is running, there
        //    are two cases:
        //
        //      1. kafkajs detects that Kafka is unavailable when it tries to
        //         fetch the next batch. At that point, we'll likely have some
        //         messages loaded into memory whose offset we haven't committed
        //         yet, and that we haven't yet tried to upload to s3. By
        //         default kafkajs will try to reconnect for a while; if that
        //         fails, I think an error is eventually raised (either thrown
        //         or as the "CRASH" event), in which case we should be good:
        //         the buffered-but-not-uploaded-to-s3 messages will be
        //         discarded and reprocessed when the worker restarts.
        //
        //      2. kafkajs detects that kafka is unavailable when it tries to
        //         commit the offsets, _after uploading the batch to s3_. This
        //         is the tricky case. Kafkajs will already retry committing the
        //         offsets but, if that fails, what do we do? If we shut down
        //         the worker, the consumer will restart with a different uuid
        //         and duplicate data will end up in s3. To avoid this, we need
        //         to make the s3 upload truly idempotent -- i.e., the next time
        //         the worker retries/restarts, the generated upload will have
        //         the exact same rows and file name. The only way to do that, I
        //         think, is to make the file name include the partition id
        //         (assuming that partition id + high-res timestamp of first
        //         message is a unique, stable id for a batch) and make sure the
        //         file/batch always has a consistent number of records.
        //         Unfortunately, this approach requires keeping in-memory
        //         batches for each partition, which is gonna mean more memory
        //         usage and a bigger amount of work to redo if the worker
        //         crashes, but I think it's still the best option, so that's
        //         what we do below.
        //          - NB: this means we can't resize batches or this will break.
        //
        // 5. If a partition gets reassigned while there's data for it in the
        //    batch in memory, we need to clear that out. I don't think it
        //    matters if there's a race condition here and with an s3 upload,
        //    thanks to the idempotence.
        //
        // 6. If the S3 upload takes a long time (cuz it's retrying or it's just
        //    a big file and there's some intermittent network hiccup), we
        //    probably want to make sure that Kafka doesn't think the consumer
        //    is dead and needlessly reassign its partitions. So, that could
        //    mean sending some heartbeats outside of the built-in kafkajs flow.
        //
        // NB: this is all assuming that Snowflake will only ingest a file in S3
        // with the same name one time; otherwise, the idempotent re-upload
        // still could change the file modified time, which could trigger
        // Snowflake to reingest it. If that's the case, then we still have a
        // small risk of data duplication. Luckily, it seems like Snowflake
        // behaves well here, and dedupes by file md5 (idempotency keys ftw!)
        // https://stackoverflow.com/questions/59184903/snowpipe-not-working-after-upload-same-file-twice
        await consumer.connect();
        await consumer.subscribe({ topics: topicsToConsume });

        // Handle the consumer getting assigned different partitions.
        // Addresses parts of case (1) and (5) above.
        consumer.on('consumer.group_join', (e) => {
          const assignedPartitions = e.payload.memberAssignment;
          const assignedPartitionKeys = new Set(
            Object.entries(assignedPartitions).flatMap(([topic, partitions]) =>
              partitions.map((p) => jsonStringify([topic, p] as const)),
            ),
          );

          for (const partitionKey of unuploadedMessagesByPartition.keys()) {
            if (!assignedPartitionKeys.has(partitionKey)) {
              unuploadedMessagesByPartition.delete(partitionKey);
            }
          }
        });

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

        await consumer.run({
          // We need to tell Kafkajs not to automatically commit offsets,
          // because we only want to commit the offset on a partition after
          // we've successfully uploaded the messages up to that offset to S3,
          // which is something that kafkajs can't know automatically.
          autoCommit: false,

          // In addition to the Kafka concept of commiting an offset, kafkajs
          // defines it's own concept of "resolving" an offset. The idea is
          // supposed to be that commiting an offset is expensive/flaky (it
          // requires a network call to the kafka broker), so, instead, you can
          // just "resolve" the offset first, which records in memory that
          // you've proccessed the message. Then, kafkajs can periodically/in
          // batches actually commit the resolved offsets.
          //
          // By default, when `eachBatch` finishes successfully, kafkajs
          // automatically resolves the offsets for all messages in that batch.
          // Then, the docs say that these automatically-resolved offsets are
          // automatically commited, which we obviously don't want (for the same
          // reason that we turned off autoCommit). However, it looks like the
          // docs are wrong, and kafkajs respects the overall autoCommit setting
          // when deciding whether to auto-commit the auto-resolved offsets.
          // Nevertheless, it seemed safer to not resolve the offsets after
          // `eachBatch` finishes, just in case that did lead to those offsets
          // getting committed automatically in some code path, before the
          // actual S3 upload with the batch's content had succeded.
          // Unfortunately, the kafkajs setting to turn off the auto-resolving
          // behavior has a bug that leads to the same messages being processed
          // over and over (it looks like the last resolved offset might be part
          // of what kafkajs uses to determine which messages to fetch next), so
          // I gave up on/commented out that setting for now. See
          // https://github.com/tulios/kafkajs/issues/540#issuecomment-907748113
          // eachBatchAutoResolve: false,

          // While we're uploading one partition's messages to S3 (after we've
          // accumulated a full batch), there's no reason we shouldn't be able
          // to process other partition's messages on the main thread.
          // `partitionsConsumedConcurrently` enables that. Although just note
          // that this setting also has a fairly serious bug -- see
          // https://github.com/tulios/kafkajs/issues/945 -- so it's only safe
          // because our processing is idempotent.
          partitionsConsumedConcurrently: 4,

          eachBatch: tracer.traced(
            { operation: 'processBatch', resource: 'snowflakeIngestionWorker' },
            async function ({ batch, heartbeat }) {
              // Heartbeat every 5s while the upload is in progress/being retried
              // (kafkajs will dedupe these if we're calling heartbeat more often
              // than heartbeat interval), to avoid 30s session timeout if s3
              // upload has to be retried a few times or takes a long time.
              // Handles case (6) above.
              const heartbeatInverval = setInterval(() => {
                heartbeat().catch((reason) => {
                  tracer.logActiveSpanFailedIfAny(reason);
                });
              }, 5_000);

              try {
                const { decodedMessages: messages, topic, partition } = batch;
                const partitionKey = jsonStringify([topic, partition] as const);

                // NB: unploadedMessagesForPartition must be a Map, keyed by
                // offset, rather than an array, so that, if `eachBatch` errors
                // and is retried, the messages in the batch won't get added to
                // `unploadedMessagesForPartition` twice -- instead, they'll be
                // de-duped by offset -- to prevent duplicate data in S3.
                const unploadedMessagesForPartition =
                  unuploadedMessagesByPartition.get(partitionKey) ??
                  new Map<string, SnowflakeOutboxKafkaMessageValue>();

                // Mutate map in place, rather than cloning, for perf.
                for (const message of messages) {
                  unploadedMessagesForPartition.set(
                    message.offset,
                    message.value,
                  );
                }

                // (re)assign to `unuploadedMessagesByPartition`, in case
                // `unploadedMessagesForPartition` was newly created above.
                unuploadedMessagesByPartition.set(
                  partitionKey,
                  unploadedMessagesForPartition,
                );

                // NB: we can't change this 30,000 number w/o risking duplicate
                // data in s3 or a smaller upload overwriting the bigger one.
                // Would need to pause all consumers, change it for all of them,
                // then resume.
                //
                // NB: 30,000 rows is (currently) ~190mb as a JSON blob -- though
                // the data we send to s3 is somewhat less (~130mb) b/c it doesn't
                // have the `recorded_at` date for each row. This is probably the
                // max we should upload at once, to not get too far from
                // Snowflake's recommended size (150mb), and to not have to retry
                // too much data if an upload to S3 fails. It also means that our
                // Node memory use, which is roughly (size of a batch as JSON +
                // size of a batch as in-memory JS objects + 200mb overhead)
                // should stay well under the limit, and give garbage collection a
                // bit of breathing room for how often it needs to kick in.
                if (unploadedMessagesForPartition.size >= 30_000) {
                  try {
                    // prettier-ignore
                    await tracer.addActiveSpan(
                    { operation: 'storeBatch', resource: 'snowflakeIngestionWorker' },
                    async () => storeBatch(
                      s3StoreObject,
                      partitionKey,
                      // Cast to non-empty array is safe cuz of `if` test above.
                      [...unploadedMessagesForPartition.values()] satisfies
                        SnowflakeOutboxKafkaMessageValue[] as
                        NonEmptyArray<SnowflakeOutboxKafkaMessageValue>
                    )
                  );

                    // commit offset only after storing successfully. The +1 here
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

                    // Then clear the batch!
                    unuploadedMessagesByPartition.delete(partitionKey);
                  } catch (e: unknown) {
                    tracer.logActiveSpanFailedIfAny(e);
                    // Rethrow to trigger eachBatch retry, which addresses
                    // error cases (2) and (4.2). This'll trigger eachBatch to be
                    // retried, until the process eventually crashes. See comment on
                    // the crash listener.
                    throw e;
                  }
                }
              } finally {
                clearInterval(heartbeatInverval);
              }
            },
          ),
        });
      },
      async shutdown() {
        await consumer.disconnect();
      },
    } satisfies Worker;
  },
);

async function storeBatch(
  storeObject: S3StoreObject,
  partitionGuid: PartitionGuid,
  batch: NonEmptyArray<{ dataJSON: string; recordedAt: Date; table: string }>,
) {
  const startDate = new Date(batch[0].recordedAt);
  const { year, ...startDateParts } = getUtcParts(startDate);

  // pad all date parts (except year) to consistent lengths, to make sure that
  // they sort correctly lexiographically in snowflake (i.e., to make sure they
  // get ingested in the right order, if snowflake pays attention to that).
  // This is also why we add the partition id at the _end_ of the file name.
  const ms = pad('0', 3, String(startDateParts.milliseconds));
  const { month, date, hour, minute, second } = mapValues(
    startDateParts,
    (it) => pad('0', 2, String(it)),
  );

  // make a new folder for every 10 minute increment.
  // see https://docs.snowflake.com/en/user-guide/data-load-considerations-manage.html#partitioning-staged-data-files
  const minuteBucket = minute[0];

  // NB: We use no punctuation in HH:MM:SS.MS, and b64url encode the partition
  // id, to ensure the resulting filename is safe in S3 and Snowflake.
  const encodedPartitionGuid = b64UrlEncode(partitionGuid);
  const fileName =
    'api/INGESTED_JSON/' +
    `${year}/${month}/${date}/${hour}/${minuteBucket}/` +
    `${year}-${month}-${date}T${hour}${minute}${second}${ms}${encodedPartitionGuid}.json.zst`;

  // TODO: consider creating a ReadableStream that yields one buffer of data
  // at a time, rather than concatenating all these buffers and passing in
  // that result, as I think the `Buffer.concat()` call is gonna allocate a
  // new (~100mb) buffer too. But profiling shows that this is not a huge
  // expense -- the `Buffer.concat()` call only amounts for 2% of total CPU
  // usage, and it looks like much of the underlying memory is reused -- so
  // this is a low priority. This is why we profile first, kids!
  const data = Buffer.concat(
    batch.map((it) =>
      Buffer.from(
        // eslint-disable-next-line no-restricted-syntax
        `{"table":${JSON.stringify(it.table)},"data":${it.dataJSON}}` + '\n',
        'utf8',
      ),
    ),
  );

  // Upload compressed data to s3
  await storeObject(fileName, await compress(data, 6));
}
