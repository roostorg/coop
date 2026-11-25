import { readFileSync } from 'fs';
import { dirname, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

import { makePostgresDatabaseConfig } from './pg-base.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const relativePath = (it: string) => pathJoin(__dirname, it);

// Mirrors server/iocContainer/pgSsl.ts for the API_SERVER_DATABASE_* settings.
function makeSslOptions() {
  const sslSetting = (process.env.API_SERVER_DATABASE_SSL ?? '')
    .trim()
    .toLowerCase();
  if (!['', 'true', '1', 'yes', 'false', '0', 'no'].includes(sslSetting)) {
    throw new Error(
      `Invalid API_SERVER_DATABASE_SSL "${process.env.API_SERVER_DATABASE_SSL}"; expected true or false`,
    );
  }
  const enabled = ['true', '1', 'yes'].includes(sslSetting);
  const modeSetting =
    process.env.API_SERVER_DATABASE_SSL_MODE?.trim().toLowerCase();
  const caPath = process.env.API_SERVER_DATABASE_SSL_CA?.trim();
  if (!enabled) {
    if (modeSetting || caPath) {
      throw new Error(
        'API_SERVER_DATABASE_SSL_MODE or API_SERVER_DATABASE_SSL_CA is set but API_SERVER_DATABASE_SSL is not true; enable SSL or unset them',
      );
    }
    return undefined;
  }
  const mode = modeSetting || 'verify-full';
  switch (mode) {
    case 'require':
      return { require: true, rejectUnauthorized: false };
    case 'verify-ca':
    case 'verify-full':
      if (mode === 'verify-ca' && !caPath) {
        throw new Error(
          'API_SERVER_DATABASE_SSL_MODE=verify-ca requires API_SERVER_DATABASE_SSL_CA',
        );
      }
      return {
        require: true,
        rejectUnauthorized: true,
        ...(caPath ? { ca: readCa(caPath) } : {}),
        ...(mode === 'verify-ca'
          ? { checkServerIdentity: () => undefined }
          : {}),
      };
    default:
      throw new Error(
        `Invalid API_SERVER_DATABASE_SSL_MODE "${mode}"; expected require, verify-ca or verify-full`,
      );
  }
}

function readCa(path: string) {
  let ca: string;
  try {
    ca = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(
      `Cannot read API_SERVER_DATABASE_SSL_CA at ${path}: ${String(e)}`,
    );
  }
  if (!ca.trim()) {
    throw new Error(`API_SERVER_DATABASE_SSL_CA at ${path} is empty`);
  }
  return ca;
}

// OpenSSL verification errors that API_SERVER_DATABASE_SSL_CA fixes. Others,
// such as an expired certificate, need a fix on the database side.
const UNTRUSTED_CERT_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_UNTRUSTED',
]);

const SSL_HINT_SUFFIX = `To connect without verifying the certificate (insecure), set API_SERVER_DATABASE_SSL_MODE=require. See https://roostorg.github.io/coop/latest/development/deployment.html#postgres-tls`;

function addSslHint(err: unknown) {
  if (!(err instanceof Error) || !('code' in err)) return;
  if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    err.message += `. If the certificate is valid but doesn't name this host, set API_SERVER_DATABASE_SSL_MODE=verify-ca and API_SERVER_DATABASE_SSL_CA. ${SSL_HINT_SUFFIX}`;
  } else if (
    typeof err.code === 'string' &&
    UNTRUSTED_CERT_ERROR_CODES.has(err.code)
  ) {
    err.message += `. If your Postgres provider uses its own certificate authority, set API_SERVER_DATABASE_SSL_CA to its CA bundle. ${SSL_HINT_SUFFIX}`;
  }
}

class PgClientWithSslHints extends pg.Client {
  constructor(config?: string | pg.ClientConfig) {
    super(config);
    // Wraps the instance's connect, which both its callback and promise forms
    // go through; the @types/pg versions in this repo type it differently.
    type Connect = (
      callback?: (err: Error | null, ...rest: unknown[]) => void,
    ) => Promise<unknown> | undefined;
    const connect = this.connect.bind(this) as unknown as Connect;
    const connectWithHints: Connect = (
      callback,
    ): Promise<unknown> | undefined => {
      if (callback) {
        return connect((err, ...rest) => {
          addSslHint(err);
          callback(err, ...rest);
        });
      }
      return connect()?.catch((err: unknown) => {
        addSslHint(err);
        throw err;
      });
    };
    this.connect = connectWithHints as unknown as typeof this.connect;
  }
}

const ssl = makeSslOptions();

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
  },
  // Omitted when off (exactOptionalPropertyTypes).
  ...(ssl ? { ssl, pgClient: PgClientWithSslHints } : {}),
});
