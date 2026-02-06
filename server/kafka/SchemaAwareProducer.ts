import type {
  ConnectEvent,
  DisconnectEvent,
  InstrumentationEvent,
  Kafka as KafkaJS,
  ProducerBatch as KafkaJSProducerBatch,
  ProducerRecord as KafkaJSProducerRecord,
  Message as KafkaJSWriteMessage,
  Producer,
  ProducerConfig,
  ProducerEvents,
  RemoveInstrumentationEventListener,
  RequestEvent,
  RequestQueueSizeEvent,
  RequestTimeoutEvent,
} from 'kafkajs';

import {
  type AnyTopicSchemaMap,
  type KeyTypes,
  type SchemaRegistry,
  type ValueTypes,
} from './SchemaAwareClient.js';
// This is imported just so that the docblock comment can link to it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import SchemaAwareConsumer from './SchemaAwareConsumer.js';

// Represents a message to produce to a topic before it's encoded.
// NB: for best accuracy, Topic should be instantiated w/ a single string
// literal type (as we do in ProducerBatch) rather than a union of literals.
type TopicMessage<T extends AnyTopicSchemaMap, Topic extends keyof T> = Omit<
  KafkaJSWriteMessage,
  'key' | 'value'
> & {
  key?: KeyTypes<Pick<T, Topic>>;
  value: ValueTypes<Pick<T, Topic>>;
};

type TopicMessages<T extends AnyTopicSchemaMap, Topic extends keyof T> = {
  topic: Topic;
  messages: TopicMessage<T, Topic>[];
};

type ProducerRecord<T extends AnyTopicSchemaMap, Topic extends keyof T> = Omit<
  KafkaJSProducerRecord,
  'topic' | 'messages'
> &
  TopicMessages<T, Topic>;

type ProducerBatch<T extends AnyTopicSchemaMap, Topics extends keyof T> = Omit<
  KafkaJSProducerBatch,
  'topicMessages'
> & { topicMessages: { [Topic in Topics]: TopicMessages<T, Topic> }[Topics][] };

/**
 * This class is analogous to the {@link SchemaAwareConsumer} class,
 * so see that class for details behind the implementation rationale.
 *
 * TODO: support producer transactions.
 */
export default class SchemaAwareProducer<T extends AnyTopicSchemaMap> {
  readonly #schemaMap: T;
  readonly #registry: SchemaRegistry<T>;
  readonly #producer: Producer;
  public readonly config: ProducerConfig | undefined;

  constructor(
    client: KafkaJS,
    registry: SchemaRegistry<T>,
    schemaMap: T,
    config?: ProducerConfig,
  ) {
    this.config = config;
    this.#registry = registry;
    this.#schemaMap = schemaMap;
    this.#producer = client.producer(config);
  }

  async #encodeTopicMessage<Topic extends keyof T>(
    topic: Topic,
    message: TopicMessage<T, Topic>,
  ) {
    const { keySchema, valueSchema } = this.#schemaMap[topic];
    const [key, value] = await Promise.all([
      message.key != null
        ? this.#registry.encode(keySchema, message.key)
        : null,
      message.value != null
        ? this.#registry.encode(valueSchema, message.value)
        : null,
    ]);

    return { ...message, key, value };
  }

  async #encodeTopicMessages<Topic extends keyof T>(
    it: TopicMessages<T, Topic>,
  ) {
    return Promise.all(
      // We don't make the map callback async as that just wastefully allocates
      // (a lot) of extra promises. (We're already ensured that synchronosuly
      // thrown errors in `#encodeTopicMessage` will be handled correctly
      // because it's an async function.)
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      it.messages.map((message) => this.#encodeTopicMessage(it.topic, message)),
    );
  }

  async send<Topic extends keyof T & string>(record: ProducerRecord<T, Topic>) {
    return this.#producer.send({
      ...record,
      messages: await this.#encodeTopicMessages(record),
    });
  }

  async sendBatch<Topics extends keyof T & string>(
    batch: ProducerBatch<T, Topics>,
  ) {
    return this.#producer.sendBatch({
      ...batch,
      topicMessages: await Promise.all(
        batch.topicMessages.map(async (it) => ({
          ...it,
          messages: await this.#encodeTopicMessages(it),
        })),
      ),
    });
  }

  async connect() {
    return this.#producer.connect();
  }

  async disconnect() {
    return this.#producer.disconnect();
  }

  isIdempotent() {
    return this.#producer.isIdempotent();
  }

  get events() {
    return this.#producer.events;
  }

  on(
    eventName: ProducerEvents['CONNECT'],
    listener: (event: ConnectEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ProducerEvents['DISCONNECT'],
    listener: (event: DisconnectEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ProducerEvents['REQUEST'],
    listener: (event: RequestEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ProducerEvents['REQUEST_QUEUE_SIZE'],
    listener: (event: RequestQueueSizeEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ProducerEvents['REQUEST_TIMEOUT'],
    listener: (event: RequestTimeoutEvent) => void,
  ): RemoveInstrumentationEventListener<typeof eventName>;
  on(
    eventName: ProducerEvents[keyof ProducerEvents],
    // The type parameter here has to be `any` (or some union that'd be hard to
    // generate), rather than unknown, for TS to allow the overloads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (event: InstrumentationEvent<any>) => void,
  ): RemoveInstrumentationEventListener<typeof eventName> {
    return this.#producer.on(eventName, listener);
  }
}
