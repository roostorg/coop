import env from '#start/env';
import type {
  ClusterNode,
  ClusterOptions,
  DNSLookupFunction,
  RedisOptions,
} from 'ioredis';

/**
 * Redis connections, shaped after `@adonisjs/redis`' `defineConfig`: a map of
 * named connections, each either plain ioredis options or a cluster config.
 * The two are told apart by the presence of `clusters`, so consumers branch on
 * the shape they are handed rather than re-reading `REDIS_USE_CLUSTER`.
 */
type ClusterConnection = {
  clusters: ClusterNode[];
  clusterOptions: ClusterOptions;
};

export type RedisConnection = RedisOptions | ClusterConnection;

const host = env.get('REDIS_HOST');
const port = env.get('REDIS_PORT', 6379);
const password = env.get('REDIS_PASSWORD');
const user = env.get('REDIS_USER');

/**
 * AUTH-enabled Redis (e.g. ElastiCache with an auth token) rejects every
 * command with NOAUTH unless credentials are sent, which leaves ioredis stuck
 * before "ready" and parks commands in the offline queue forever. Local dev
 * Redis has no password, so only pass credentials when REDIS_PASSWORD is set;
 * REDIS_USER may be set-but-empty, which means the default user.
 */
const auth: RedisOptions = password
  ? {
      ...(user ? { username: user } : {}),
      password: password.release(),
    }
  : {};

/**
 * See
 * https://github.com/luin/ioredis/blob/c275e9a337a4aee1565e96fe631d28a29ecb4efa/README.md#special-note-aws-elasticache-clusters-with-tls
 */
const dnsLookup: DNSLookupFunction = (address, callback) =>
  callback(null, address);

function connection(extra: RedisOptions = {}): RedisConnection {
  const options: RedisOptions = {
    // Required by BullMQ: its workers use blocking Redis commands that would
    // otherwise be misinterpreted as timed-out requests.
    maxRetriesPerRequest: null,
    ...auth,
    ...extra,
  };

  return env.get('REDIS_USE_CLUSTER')
    ? {
        clusters: [{ host, port }],
        clusterOptions: {
          dnsLookup,
          // Cluster connections are always TLS, regardless of REDIS_TLS.
          redisOptions: { tls: {}, ...options },
        },
      }
    : {
        host,
        port,
        ...options,
        ...(env.get('REDIS_TLS', false) && { tls: { servername: host } }),
      };
}

export default {
  connections: {
    main: connection(),
    /**
     * With `enableOfflineQueue: false`, a `queue.addBulk` while Redis is
     * unreachable rejects immediately instead of resolving against the
     * in-process buffer, failing the enqueue early with "couldn't enqueue".
     */
    enqueueNoBuffer: connection({ enableOfflineQueue: false }),
  },
};
