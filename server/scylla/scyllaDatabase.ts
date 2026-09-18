import { createRequire } from 'node:module';
import type * as CassandraDriver from 'cassandra-driver';
import { type ClientOptions, type Host as ScyllaHost } from 'cassandra-driver';

import { logErrorJson, logJson } from '../utils/logging.js';
import { type DBDefinition } from './cqlUtils.js';
import Scylla from './scylla.js';

// The otel instrumentation currently intercepts require statements. Support for
// esm is experimental, so we should wait until it is stable; until then the
// driver has to be loaded this way or Scylla calls go untraced.
const require = createRequire(import.meta.url);
const { Client } = require('cassandra-driver') as typeof CassandraDriver;

/**
 * Forwards driver-internal warnings and errors (auth, TLS, connection drops,
 * etc.); skips the very chatty `info`/`verbose` levels.
 */
const scyllaLogger = (
  level: 'verbose' | 'info' | 'warning' | 'error',
  source: string,
  message: string,
  furtherInfo?: unknown,
) => {
  if (level !== 'warning' && level !== 'error') {
    return;
  }
  const wrapped = new Error(`scylla.${level}: [${source}] ${message}`);
  if (furtherInfo instanceof Error) {
    wrapped.stack = furtherInfo.stack ?? wrapped.stack;
  }
  // eslint-disable-next-line no-restricted-syntax
  logErrorJson({
    message: `scylla.driver.${level}`,
    error: wrapped,
  });
};

/**
 * A {@link Scylla} backed by a real cluster: owns the driver, the lifecycle
 * methods the IoC container needs to open and close it, and the operational
 * wiring (log forwarding, cluster-state visibility) that every connection
 * wants but that the query layer has no opinion about.
 *
 * `NoOpScylla` is the counterpart used when `SCYLLA_ENABLED=false`.
 */
export default class ScyllaDatabase extends Scylla<DBDefinition> {
  constructor(options: ClientOptions) {
    super(new Client(options));

    // Surface cluster state changes so reconnect storms are visible in logs.
    this.client.on('hostUp', (host: ScyllaHost) => {
      // eslint-disable-next-line no-restricted-syntax
      logJson(`scylla.hostUp address=${host.address}`);
    });
    this.client.on('hostDown', (host: ScyllaHost) => {
      // eslint-disable-next-line no-restricted-syntax
      logJson(`scylla.hostDown address=${host.address}`);
    });

    this.client.on('log', scyllaLogger);

    // cassandra-driver leaks ~4 HostMap listeners per failed `Client._connect()`
    // retry and never recreates the HostMap, so the default cap of 10 trips
    // after ~3 failures. Raise it so transient blips don't spam the warning, but
    // keep it bounded so a true runaway is still noticeable.
    this.client.hosts.setMaxListeners(15);
  }

  /** Eagerly connect; idempotent once `connected` is true. */
  async connect() {
    return this.client.connect();
  }

  async close() {
    return this.client.shutdown();
  }
}
