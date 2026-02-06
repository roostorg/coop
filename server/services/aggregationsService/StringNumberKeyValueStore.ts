import { type Cluster, type Redis } from 'ioredis';

import { inject, type Dependencies } from '../../iocContainer/index.js';

type RedisConnection = Redis | Cluster;

export class StringNumberKeyValueStore {
  private redis: RedisConnection;

  constructor(redis: Dependencies['IORedis']) {
    this.redis = redis;
  }

  async increment(key: string, extendTtlMs?: number): Promise<void> {
    let stmt = this.redis.multi().incr(key);

    if (extendTtlMs) {
      stmt = stmt.expire(key, extendTtlMs / 1000);
    }

    await stmt.exec();
  }

  async getAll(keys: string[]) {
    const results = await Promise.all(
      keys.map(async (key) => this.redis.get(key)),
    );

    return keys.reduce((acc, key, i) => {
      const result = results[i];
      if (result === null) {
        return acc;
      }

      const resultNum = parseFloat(result);
      if (Number.isInteger(resultNum)) {
        acc.set(key, resultNum);
      }

      return acc;
    }, new Map<string, number>());
  }
}

function makeStringNumberKeyValueStore(redis: Dependencies['IORedis']) {
  return new StringNumberKeyValueStore(redis);
}

export default inject(['IORedis'], makeStringNumberKeyValueStore);
