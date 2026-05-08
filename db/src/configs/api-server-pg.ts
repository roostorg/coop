import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';

import { makePostgresDatabaseConfig } from './pg-base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

// Opt-in TLS for managed Postgres providers that only accept `hostssl`
// connections. `rejectUnauthorized: false` since some providers issue a
// self-signed per-cluster CA we don't ship. Local docker Postgres has no
// TLS, so this stays off by default.
const ssl =
  process.env.API_SERVER_DATABASE_SSL === 'true'
    ? { require: true, rejectUnauthorized: false }
    : undefined;

export default makePostgresDatabaseConfig({
  defaultScriptFormat: 'sql',
  scriptsDirectory: relativePath('../scripts/api-server-pg'),
  maintenanceDatabase:
    process.env.API_SERVER_DATABASE_MAINTENANCE_NAME ?? 'postgres',
  driverOpts: {
    database: process.env.API_SERVER_DATABASE_NAME!,
    username: process.env.API_SERVER_DATABASE_USER!,
    password: process.env.API_SERVER_DATABASE_PASSWORD!,
    host: process.env.API_SERVER_DATABASE_HOST!,
    port: parseInt(process.env.API_SERVER_DATABASE_PORT ?? '5432'),
    logging: console.log,
    dialect: 'postgres',
    schema: 'public',
    pool: { max: 20 },
    // Sequelize's pg dialect ignores a top-level `ssl` field; TLS must live
    // under `dialectOptions.ssl`. Spread conditionally so the key is omitted
    // entirely when off (exactOptionalPropertyTypes).
    ...(ssl ? { dialectOptions: { ssl } } : {}),
  },
});
