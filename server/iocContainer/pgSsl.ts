import { readFileSync } from 'node:fs';
import { type ConnectionOptions } from 'node:tls';
import pg from 'pg';

const PG_SSL_MODES = ['require', 'verify-ca', 'verify-full'] as const;
export type PgSslMode = (typeof PG_SSL_MODES)[number];

/**
 * Parses DATABASE_SSL. Anything other than an explicit on or off value throws,
 * so a value such as `on` or `"true"` can't silently connect without TLS.
 */
export function isPgSslEnabled(value: string | undefined): boolean {
  const setting = value?.trim().toLowerCase() ?? '';
  if (['true', '1', 'yes'].includes(setting)) return true;
  if (['', 'false', '0', 'no'].includes(setting)) return false;
  throw new Error(`Invalid DATABASE_SSL "${value}"; expected true or false`);
}

/**
 * TLS options for `pg` from DATABASE_SSL, DATABASE_SSL_MODE and
 * DATABASE_SSL_CA, following libpq's `sslmode` names:
 * - `verify-full` (default): the server certificate must chain to a trusted CA
 *   and match the host name.
 * - `verify-ca`: the certificate must chain to the CA bundle in `caPath`; the
 *   host name is not checked. Requires `caPath`, since checking only the chain
 *   against the public CAs would accept a certificate for any domain.
 * - `require`: encrypt without verifying the certificate.
 *
 * `caPath` points to a PEM bundle for providers that use a private CA. It
 * replaces Node's default CA store rather than adding to it; without it the
 * default store is used. `require` ignores it.
 *
 * Setting a mode or CA without enabling TLS is rejected, so a misconfiguration
 * can't silently connect without TLS.
 */
export function makePgSslOptions(opts: {
  enabled: boolean;
  mode?: string;
  caPath?: string;
}): ConnectionOptions | undefined {
  const modeSetting = opts.mode?.trim().toLowerCase();
  const caPath = opts.caPath?.trim();
  if (!opts.enabled) {
    if (modeSetting || caPath) {
      throw new Error(
        'DATABASE_SSL_MODE or DATABASE_SSL_CA is set but DATABASE_SSL is not true; enable SSL or unset them',
      );
    }
    return undefined;
  }

  const mode =
    modeSetting === undefined || modeSetting === ''
      ? 'verify-full'
      : modeSetting;
  if (!isPgSslMode(mode)) {
    throw new Error(
      `Invalid DATABASE_SSL_MODE "${mode}"; expected one of ${PG_SSL_MODES.join(', ')}`,
    );
  }

  if (mode === 'require') {
    return { rejectUnauthorized: false };
  }
  if (mode === 'verify-ca' && !caPath) {
    throw new Error('DATABASE_SSL_MODE=verify-ca requires DATABASE_SSL_CA');
  }

  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: readCa(caPath) } : {}),
    ...(mode === 'verify-ca' ? { checkServerIdentity: () => undefined } : {}),
  };
}

function readCa(path: string) {
  let ca: string;
  try {
    ca = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read DATABASE_SSL_CA at ${path}`, { cause: e });
  }
  if (!ca.trim()) {
    throw new Error(`DATABASE_SSL_CA at ${path} is empty`);
  }
  return ca;
}

function isPgSslMode(it: string): it is PgSslMode {
  return (PG_SSL_MODES as readonly string[]).includes(it);
}

// OpenSSL verification errors that DATABASE_SSL_CA fixes. Others, such as an
// expired certificate, need a fix on the database side.
const UNTRUSTED_CERT_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_UNTRUSTED',
]);

const SSL_HINT_SUFFIX = `To connect without verifying the certificate (insecure), set DATABASE_SSL_MODE=require. See https://roostorg.github.io/coop/latest/development/deployment.html#postgres-tls`;

/**
 * Appends to a certificate verification error the setting that fixes it,
 * keeping its code and stack.
 */
export function addPgSslHint(err: unknown) {
  if (!(err instanceof Error) || !('code' in err)) return;
  if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    err.message += `. If the certificate is valid but doesn't name this host, set DATABASE_SSL_MODE=verify-ca and DATABASE_SSL_CA. ${SSL_HINT_SUFFIX}`;
  } else if (
    typeof err.code === 'string' &&
    UNTRUSTED_CERT_ERROR_CODES.has(err.code)
  ) {
    err.message += `. If your Postgres provider uses its own certificate authority, set DATABASE_SSL_CA to its CA bundle. ${SSL_HINT_SUFFIX}`;
  }
}

/**
 * A `pg.Client` whose connection errors explain how to fix certificate
 * verification failures.
 */
export class PgClientWithSslHints extends pg.Client {
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
          addPgSslHint(err);
          callback(err, ...rest);
        });
      }
      return connect()?.catch((err: unknown) => {
        addPgSslHint(err);
        throw err;
      });
    };
    this.connect = connectWithHints as unknown as typeof this.connect;
  }
}
