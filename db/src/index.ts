#!/usr/bin/env -S node --loader ts-node/esm --require dotenv/config
import type { DatabaseConfig } from '@roostorg/db-migrator';
import { makeCli } from '@roostorg/db-migrator';

import apiServerPostgresConfig from './configs/api-server-pg.js';

// Only load Scylla/ClickHouse configs when their env vars are present.
// The K8s db-migrate Job only targets api-server-pg and doesn't set
// SCYLLA_HOSTS or CLICKHOUSE_* vars.
const configs: Record<string, DatabaseConfig<any, any, any>> = {
  'api-server-pg': apiServerPostgresConfig,
};

if (process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_DATABASE) {
  const { default: clickhouseConfig } = await import('./configs/clickhouse.js');
  configs.clickhouse = clickhouseConfig;
}

if (process.env.SCYLLA_HOSTS) {
  const { default: scyllaConfig } = await import('./configs/scylla.js');
  configs.scylla = scyllaConfig;
}

makeCli(configs);
