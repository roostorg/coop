import kafkaJs from 'kafkajs';

import { KafkajsZstdCompressionCodec } from './KafkajsZstdCompressionCodec.js';
import SchemaAwareKafkaClient, {
  SchemaRegistry,
  type SchemaIdFor,
} from './SchemaAwareClient.js';
import {
  type ConsumerRunConfig,
  type DecodedMessage,
} from './SchemaAwareConsumer.js';
import type SchemaAwareConsumer from './SchemaAwareConsumer.js';
import type SchemaAwareProducer from './SchemaAwareProducer.js';

// Only the wrapper client class is exported, not the consumer/producer classes.
export default SchemaAwareKafkaClient;

const { CompressionCodecs, CompressionTypes } = kafkaJs;

// The line below will allow producers to generate, and consumers to read,
// messages compressed w/ zstd. However, it doesn't require (or automatically
// opt-in) the producers to using compression, nor does it stop the consumers
// from reading uncompressed messages.
//
// In Kafkajs, the registered compression codecs are global, so there's no way
// to (e.g.) provide different detailed compression options per client/
// producer/topic/message batch. In other words, any messages that request
// compression w/ zstd will get this compression level 5, which is a bit
// annoying because different topics might warrant different compression levels.
// See https://github.com/tulios/kafkajs/issues/1553
//
// Given that this setting is global, we also can't expose any
// compression-related options on the classes we export from this module,
// as they can't do any sort of local override.
CompressionCodecs[CompressionTypes.ZSTD] = () =>
  new KafkajsZstdCompressionCodec(5);

export type {
  SchemaIdFor,
  DecodedMessage,
  SchemaAwareKafkaClient as Kafka,
  SchemaAwareProducer as KafkaProducer,
  SchemaAwareConsumer as KafkaConsumer,
  ConsumerRunConfig as KafkaConsumerRunConfig,
};
export { SchemaRegistry };
