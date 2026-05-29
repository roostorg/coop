#!/usr/bin/env -S node --loader ts-node/esm --require dotenv/config
import type { DatabaseConfig } from '@roostorg/db-migrator';
import { makeCli } from '@roostorg/db-migrator';

import apiServerPostgresConfig from './configs/api-server-pg.js';
import clickhouseConfig from './configs/clickhouse.js';

// Scylla config crashes at module load without SCYLLA_HOSTS, so gate it.
const configs: Record<string, DatabaseConfig<any, any, any>> = {
  'api-server-pg': apiServerPostgresConfig,
  clickhouse: clickhouseConfig,
};

if (process.env.SCYLLA_HOSTS) {
  const { default: scyllaConfig } = await import('./configs/scylla.js');
  configs.scylla = scyllaConfig;
}

makeCli(configs);
