import genericPool from 'generic-pool';
import { type Snowflake, requireSnowflake } from './snowflake-wrapper.js';

export type SnowflakeConnectionSettings = {
  account: string;
  username: string;
  password: string;
  database: string;
  role: string;
  schema: string;
  warehouse: string;
  arrayBindingThreshold: number;
};

// The subset of genericPool.options that we're commiting to supporting in
// makeSnowflakeConnectionPool.
export type SnowflakePoolOptions = {
  max?: number;
  min?: number;
  testOnBorrow?: boolean;
  testOnReturn?: boolean;
  acquireTimeoutMillis?: number;
  evictionRunIntervalMillis?: number;
  numTestsPerEvictionRun?: number;
  softIdleTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  autostart?: boolean;
};

export default function makeSnowflakeConnectionPool(
  connectionSettings: SnowflakeConnectionSettings,
  poolSettings?: SnowflakePoolOptions,
) {
  return genericPool.createPool<Snowflake>(
    {
      create: async () => getConnection(connectionSettings),
      destroy: async (connection) => connection.destroy(),
      validate: async (connection) =>
        connection.execute('select 1').then(
          () => true,
          () => false,
        ),
    },
    {
      max: 40,
      min: 3,
      testOnBorrow: true,
      // We have a couple legit use cases where we kick off a bunch of Snowflake
      // queries in quick succession, and where these queries are long-running.
      // Since only `pool.max` of these queries can run at a time, they can end
      // up getting queued to wait for a connection for a very long time without
      // it necessarily meaning anything's wrong. So, we let the pool do that
      // queueing with a _huge_ timeout, as that's much more robust (and elegant)
      // than scattering queueing logic (e.g., `p-limit`) throughout the code.
      acquireTimeoutMillis: 600_000,

      // Every minute, try to reclaim resources by removing some connections
      // that have been idle for more than 10 minutes. My guess is that this is
      // totally unnecessary, as I think the Snowflake queries are made using
      // standard http requests, and the connections for those are probably
      // automatically pooled by Nodejs' default agent. Still, we had this logic
      // already, so might as well keep it. To prevent us from removing too many
      // (and then having to recreate them), we only delete up to 4 connections
      // per minute and use a setting (`softIdleTimeoutMillis`) that ensures
      // that we're always keeping at least `min` connections in the pool.
      evictionRunIntervalMillis: 60_000,
      numTestsPerEvictionRun: 4,
      softIdleTimeoutMillis: 600_000,

      // don't start creating connections until we start the pool explicitly (or
      // we try to issue our first query). This is important when we're running
      // tests, so we don't end up with unclosed connections.
      autostart: false,

      // Allow users to customize the above.
      ...poolSettings,
    },
  );
}

export async function getConnection(
  connectionSettings: SnowflakeConnectionSettings,
): Promise<Snowflake> {
  const SnowflakeClass = requireSnowflake();
  const snowflake = new SnowflakeClass(connectionSettings);

  await snowflake.connect().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    throw e;
  });

  return snowflake;
}
