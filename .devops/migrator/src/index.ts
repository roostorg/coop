#!/usr/bin/env -S node --loader ts-node/esm --require dotenv/config
import { makeCli } from '@roostorg/db-migrator';

import apiServerPostgresConfig from './configs/api-server-pg.js';
import clickhouseConfig from './configs/clickhouse.js';
import scyllaConfig from './configs/scylla.js';
import snowflakeConfig from './configs/snowflake.js';

makeCli({
  'api-server-pg': apiServerPostgresConfig,
  clickhouse: clickhouseConfig,
  snowflake: snowflakeConfig,
  scylla: scyllaConfig,
});
