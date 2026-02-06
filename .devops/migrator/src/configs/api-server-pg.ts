import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';

import { makePostgresDatabaseConfig } from './pg-base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

export default makePostgresDatabaseConfig({
  defaultScriptFormat: 'sql',
  scriptsDirectory: relativePath('../scripts/api-server-pg'),
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
  },
});
