import { SchemaRegistry as UntypedSchemaRegistry } from '@kafkajs/confluent-schema-registry';
import type { ConsumerConfig, Kafka as KafkaJS, KafkaConfig, ProducerConfig } from 'kafkajs';

import { createRequire } from 'module';
import SchemaAwareConsumer from './SchemaAwareConsumer.js';
import SchemaAwareProducer from './SchemaAwareProducer.js';

// NB: we import kafkajs using require() here instead of import because the
// open-telemetry instrumentations intercepts only require() calls in order
// to patch modules. If kafkajs is imported using import, it won't be patched.
const require = createRequire(import.meta.url);
const {Kafka: KafkaClient} = require('kafkajs')

// Generic fake symbol for holding type-level metadata.
declare const meta: unique symbol;

// This type holds the id of a schema in the Schema Registry, alongside
// TS type-level metadata showing the expected shape of the decoded message.
export type SchemaIdFor<T> = number & { readonly [meta]: T };

// Allows storing the Schema Registry, with some TS metadata reflecting
// which schemas have been registered with the registry.
export type SchemaRegistry<T extends AnyTopicSchemaMap> =
  UntypedSchemaRegistry & { readonly [meta]: T };

// Re-export the SchemaRegistry constructor w/ a type cast that lets us hold
// registered schema metadata in the type param.
export const SchemaRegistry = UntypedSchemaRegistry as new <
  T extends AnyTopicSchemaMap,
>(
  args: ConstructorParameters<typeof UntypedSchemaRegistry>[0],
  options?: ConstructorParameters<typeof UntypedSchemaRegistry>[1],
) => SchemaRegistry<T>;

export type AnyTopicSchemaMap = {
  [topicName: string]: {
    keySchema: SchemaIdFor<unknown>;
    valueSchema: SchemaIdFor<unknown>;
  };
};

// A union of the message key types for the given topics.
export type KeyTypes<T extends AnyTopicSchemaMap> =
  T[keyof T]['keySchema'][typeof meta];

// A union of the message value types for the given topics.
export type ValueTypes<T extends AnyTopicSchemaMap> =
  T[keyof T]['valueSchema'][typeof meta];

/**
 * Constructs a wrapped Kafka client instance that's aware of the Schema
 * Registry and our schemas in it.
 */
export default class Kafka<TopicSchemaMap extends AnyTopicSchemaMap> {
  readonly #client: KafkaJS;
  readonly #schemaMap: TopicSchemaMap;
  readonly #registry: SchemaRegistry<TopicSchemaMap>;

  constructor(
    config: KafkaConfig,
    schemaMap: TopicSchemaMap,
    registry: SchemaRegistry<TopicSchemaMap>,
  ) {
    this.#client = new KafkaClient(config);
    this.#schemaMap = schemaMap;
    this.#registry = registry;
  }

  public producer(config?: ProducerConfig) {
    return new SchemaAwareProducer(
      this.#client,
      this.#registry,
      this.#schemaMap,
      // Unlike in Kafkajs, default allowAutoTopicCreation to false, since it's
      // not a super safe setting. We may have to revise this as we think about
      // the local dev story (and it may not be necessary if we have proper ACLs
      // in prod that bans our clients from creating topics).
      { allowAutoTopicCreation: false, ...config },
    );
  }

  /**
   * The Topics type parameter should be filled in with the list of topic names
   * that the consumer might subscribe to. (It will only be allowed to subscribe
   * to these topics, and all of these topics must have a corresponding registered
   * schema.) In KafkaJS, choosing which topics to subscribe to and then actually
   * consuming the messages on those topics are two separate operations.
   * However, we have to link them in the types (i.e., the type of each decoded
   * message needs to depend on which topics the consumer has subscribed to), so
   * we use this Topics type parameter to do that.
   */
  public consumer<Topics extends keyof TopicSchemaMap>(config: ConsumerConfig) {
    return new SchemaAwareConsumer(
      this.#client,
      this.#registry as SchemaRegistry<Pick<TopicSchemaMap, Topics>>,
      config,
    );
  }
}
