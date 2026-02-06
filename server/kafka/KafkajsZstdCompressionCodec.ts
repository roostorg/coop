import { compress, decompress } from '@mongodb-js/zstd';

// The encoder class from Kafkajs doesn't have an exported type,
// but we can make a minimal stub in the meantime.
// See https://github.com/tulios/kafkajs/issues/1552
type Encoder = { buffer: Buffer };

export class KafkajsZstdCompressionCodec {
  constructor(private readonly level: number) {}

  async compress(encoder: Encoder) {
    return compress(encoder.buffer, this.level);
  }

  async decompress(buffer: Buffer) {
    return decompress(buffer);
  }
}
