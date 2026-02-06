import {
  type ConnectEvent,
  type Consumer,
  type ConsumerCommitOffsetsEvent,
  type ConsumerConfig,
  type ConsumerCrashEvent,
  type ConsumerEndBatchProcessEvent,
  type ConsumerEvents,
  type ConsumerFetchEvent,
  type ConsumerFetchStartEvent,
  type ConsumerGroupJoinEvent,
  type ConsumerHeartbeatEvent,
  type ConsumerRebalancingEvent,
  type ConsumerReceivedUnsubcribedTopicsEvent,
  type ConsumerStartBatchProcessEvent,
  type DisconnectEvent,
  type InstrumentationEvent,
  type TopicPartition as KafakJSTopicPartition,
  type TopicPartitionOffset as KafakJSTopicPartitionOffset,
  type TopicPartitionOffsetAndMetadata as KafakJSTopicPartitionOffsetAndMetadata,
  type Kafka as KafkaJS,
  type ConsumerRunConfig as KafkaJSConsumerRunConfig,
  type ConsumerSubscribeTopics as KafkaJSConsumerSubscribeTopics,
  type EachBatchPayload as KafkaJSEachBatchPayload,
  type EachMessagePayload as KafkaJSEachMessagePayload,
  type KafkaMessage,
  type RemoveInstrumentationEventListener,
  type RequestEvent,
  type RequestQueueSizeEvent,
  type RequestTimeoutEvent,
  type KafkaJSError as KafkaJSErrorType,
  type KafkaJSProtocolError as KafkaJSProtocolErrorType
} from 'kafkajs';
import kafkaJs from 'kafkajs';

const { KafkaJSError, KafkaJSProtocolError } = kafkaJs;


import { type Mutable } from '../utils/typescript-types.js';
import {
  type AnyTopicSchemaMap,
  type KeyTypes,
  type SchemaRegistry,
  type ValueTypes,
} from './SchemaAwareClient.js';

// Redefine a number of types to support subscribing to/processing messages
// from topics that have a registered schema in a type-safe way.
type ConsumerSubscribeTopics<T extends AnyTopicSchemaMap> = Pick<
  KafkaJSConsumerSubscribeTopics,
  'fromBeginning'
> & { topics: readonly (keyof T & string)[] };

export type DecodedMessage<EligibleTopics extends AnyTopicSchemaMap> = Omit<
  KafkaMessage,
  'key' | 'value'
> & {
  key: KeyTypes<EligibleTopics> | null;
  value: ValueTypes<EligibleTopics> | null;
};

type EachMessagePayload<T extends AnyTopicSchemaMap> = Omit<
  KafkaJSEachMessagePayload,
  'message' | 'topic'
> & { topic: keyof T & string; message: DecodedMessage<T> };

type EachBatchPayload<T extends AnyTopicSchemaMap> = Omit<
  KafkaJSEachBatchPayload,
  'batch'
> & {
  batch: Omit<KafkaJSEachBatchPayload['batch'], 'topic'> & {
    topic: keyof T & string;
    decodedMessages: DecodedMessage<T>[];
  };
};

export type ConsumerRunConfig<T extends AnyTopicSchemaMap> = Pick<
  KafkaJSConsumerRunConfig,
  | 'autoCommit'
  | 'autoCommitInterval'
  | 'autoCommitThreshold'
  | 'eachBatchAutoResolve'
  | 'partitionsConsumedConcurrently'
> & {
  eachBatch?: (payload: EachBatchPayload<T>) => Promise<void>;
  eachMessage?: (payload: EachMessagePayload<T>) => Promise<void>;
};

type TopicPartition<EligibleTopics extends AnyTopicSchemaMap> = Omit<
  KafakJSTopicPartition,
  'topic'
> & { topic: keyof EligibleTopics & string };

type TopicPartitionOffset<EligibleTopics extends AnyTopicSchemaMap> = Omit<
  KafakJSTopicPartitionOffset,
  'topic'
> & { topic: keyof EligibleTopics & string };

type TopicPartitionOffsetAndMetadata<EligibleTopics extends AnyTopicSchemaMap> =
  Omit<KafakJSTopicPartitionOffsetAndMetadata, 'topic'> & {
    topic: keyof EligibleTopics & string;
  };

/**
 * Returns a Kafka consumer whose received messages will be transparently
 * decoded using their schema in the schema registry.
 *
 * Note overridden argument types, to only allow subscribing to/processing
 * messages from known topics.
 */
export default class SchemaAwareConsumer<
  EligibleTopicsSchemaMap extends AnyTopicSchemaMap,
> {
  readonly #registry: SchemaRegistry<EligibleTopicsSchemaMap>;
  readonly #consumer: Consumer;
  public readonly config: ConsumerConfig;

  constructor(
    client: KafkaJS,
    registry: SchemaRegistry<EligibleTopicsSchemaMap>,
    config: ConsumerConfig,
  ) {
    this.config = config;
    this.#registry = registry;
    this.#consumer = client.consumer(config);
  }

  async #decodeMessage(message: KafkaMessage) {
    const [key, value] = await Promise.all([
      message.key ? this.#registry.decode(message.key) : message.key,
      message.value ? this.#registry.decode(message.value) : message.value,
    ]);

    return {
      ...message,
      key: key as KeyTypes<EligibleTopicsSchemaMap>,
      value: value as ValueTypes<EligibleTopicsSchemaMap>,
    };
  }

  async run(config?: ConsumerRunConfig<EligibleTopicsSchemaMap>) {
    return this.#consumer.run({
      // This cast helps TS understand that eachBatch and eachMessage, if
      // present on config, will always get overridden before being passed to
      // this.#consumer.run (i.e., will never be passed with the type defined in
      // ConsumerRunConfig<T>).
      ...(config as Omit<typeof config, 'eachBatch' | 'eachMessage'>),
      ...(config?.eachBatch
        ? {
            eachBatch: async (payload) => {
              // TODO: does this need plimit? It shouldn't bc the schema is
              // cached, but idk if the cache is smart enough to avoid a huge
              // spike in initial requests for the schema(s) if the batch kicks
              // off a lot of decodes at a time.
              const decodedMessages = await Promise.all(
                payload.batch.messages.map(async (msg) =>
                  this.#decodeMessage(msg),
                ),
              );

              // We have to create the new batch by putting the original batch
              // in the prototype chain, in order for methods on the batch
              // object (like `lastOffset()`) to continue to work. We can't use
              // something like { ...origBatch, messages: decodedMessages } as
              // the new batch.
              return config.eachBatch!({
                ...payload,
                batch: Object.create(payload.batch, {
                  decodedMessages: {
                    value: decodedMessages,
                    writable: false,
                    configurable: false,
                    enumerable: true,
                  },
                }) as typeof payload.batch & {
                  decodedMessages: typeof decodedMessages;
                },
              });
            },
          }
        : {}),
      ...(config?.eachMessage
        ? {
            eachMessage: async (payload) => {
              return config.eachMessage!({
                ...payload,
                message: await this.#decodeMessage(payload.message),
              });
            },
          }
        : {}),
    });
  }

  // Bunch of blindly delegated methods below, although with arg types redefined
  // for some of them to limit the set of applicable topics like above.
  //
  // These delegated methods are explicitly enumerated on purpose (rather than
  // just, e.g., putting the kakfajs consumer instance in the prototype chain)
  // to make sure that the abstraction isn't leaky; i.e., that some KafkaJS API
  // isn't automatically delegated to that exposes messages without calling
  // registry.decode() on them. This choice of explicit delegation reflects that
  // I'd rather have the API surface be missing some KafkaJS methods (which can
  // easily be added if needed) than have the abstraction inadvertently leak.
  async subscribe(opts: ConsumerSubscribeTopics<EligibleTopicsSchemaMap>) {
    return this.#consumer.subscribe(
      // cast bc kafkajs' typings incorrectly fail to mark the `topics` key as
      // readonly (which it should be, since kafkajs doesn't mutate this array)
      opts as Omit<typeof opts, 'topics'> & {
        topics: Mutable<typeof opts.topics>;
      },
    );
  }

  async commitOffsets(
    topicPartitions: TopicPartitionOffsetAndMetadata<EligibleTopicsSchemaMap>[],
  ) {
    try {
      return await this.#consumer.commitOffsets(topicPartitions);
    } catch (e) {
      // We want to unwrap the underlying KafkaJSProtocolError and throw that
      // instead. This is because there is logic within the KafkaJS library
      // that handles KafkaJSProtocolErrors, and will e.g. recover and
      // rejoin the group on errors that are associated with rebalancing.
      // However, the error thrown by consumer.commitOffsets() is always
      // wrapped in a KafkaJSNonRetriableError because it went through the
      // retrier already. This prevents the KafkaJSProtocolError from being
      // gracefully handled by the library unless we unwrap and throw it here.
      //
      // Alternatively we could turn on autoCommit for the simpler
      // consumers, which currently throws protocol errors directly.
      if (e instanceof KafkaJSError) {
        throw unwrapProtocolError(e) ?? e;
      }

      throw e;
    }
  }

  async seek(
    topicPartitionOffset: TopicPartitionOffset<EligibleTopicsSchemaMap>,
  ) {
    return this.#consumer.seek(topicPartitionOffset);
  }

  async pause(topics: TopicPartition<EligibleTopicsSchemaMap>[]) {
    return this.#consumer.pause(topics);
  }

  async resume(topics: TopicPartition<EligibleTopicsSchemaMap>[]) {
    return this.#consumer.resume(topics);
  }

  async stop() {
    return this.#consumer.stop();
  }

  async connect() {
    return this.#consumer.connect();
  }

  async disconnect() {
    return this.#consumer.disconnect();
  }

  // Overloads copied straight from the KafkaJS typings.
  // This is hella ugly, but idk a better alternative.
  on(
    eventName: ConsumerEvents['HEARTBEAT'],
    listener: (event: ConsumerHeartbeatEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['COMMIT_OFFSETS'],
    listener: (event: ConsumerCommitOffsetsEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['GROUP_JOIN'],
    listener: (event: ConsumerGroupJoinEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['FETCH_START'],
    listener: (event: ConsumerFetchStartEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['FETCH'],
    listener: (event: ConsumerFetchEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['START_BATCH_PROCESS'],
    listener: (event: ConsumerStartBatchProcessEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['END_BATCH_PROCESS'],
    listener: (event: ConsumerEndBatchProcessEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['CONNECT'],
    listener: (event: ConnectEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['DISCONNECT'],
    listener: (event: DisconnectEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['STOP'],
    listener: (event: InstrumentationEvent<null>) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['CRASH'],
    listener: (event: ConsumerCrashEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['REBALANCING'],
    listener: (event: ConsumerRebalancingEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['RECEIVED_UNSUBSCRIBED_TOPICS'],
    listener: (event: ConsumerReceivedUnsubcribedTopicsEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['REQUEST'],
    listener: (event: RequestEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['REQUEST_TIMEOUT'],
    listener: (event: RequestTimeoutEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents['REQUEST_QUEUE_SIZE'],
    listener: (event: RequestQueueSizeEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ConsumerEvents[keyof ConsumerEvents],
    // The type parameter here has to be `any` (or some union that'd be hard to
    // generate), rather than unknown, for TS to allow the overloads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (event: InstrumentationEvent<any>) => void,
  ): RemoveInstrumentationEventListener<typeof eventName> {
    return this.#consumer.on(eventName, listener);
  }

  public get events() {
    return this.#consumer.events;
  }
}

// Helper function to unwrap the underlying KafkaJSProtocolError from a
// KafkaJSError, if present.
function unwrapProtocolError(e: KafkaJSErrorType): KafkaJSProtocolErrorType | undefined {
  if (e instanceof KafkaJSProtocolError) {
    return e;
  }

  if (e.cause && e.cause instanceof KafkaJSError) {
    return unwrapProtocolError(e.cause);
  }

  return undefined;
}
