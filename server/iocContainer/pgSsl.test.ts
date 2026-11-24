import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { createPgPool } from './createPgPool.js';
import { getPgConnectionParams } from './index.js';
import {
  addPgSslHint,
  isPgSslEnabled,
  makePgSslOptions,
  PgClientWithSslHints,
} from './pgSsl.js';

// Throwaway test CA, certificate and key; regenerate with
// __fixtures__/pgSsl/generate.sh.
const fixture = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/pgSsl/${name}`, import.meta.url));

// Accepts Postgres's SSLRequest, completes a TLS handshake with a certificate
// for IP 127.0.0.1 signed by the fixture CA, then hangs up.
async function startFakeTlsPostgres() {
  const secureContext = tls.createSecureContext({
    cert: readFileSync(fixture('server.pem')),
    key: readFileSync(fixture('server.key')),
  });
  let handshakes = 0;
  const server = net.createServer((socket) => {
    socket.once('data', () => {
      socket.write('S');
      const tlsSocket = new tls.TLSSocket(socket, {
        isServer: true,
        secureContext,
      });
      tlsSocket.on('secure', () => {
        handshakes += 1;
        tlsSocket.destroy();
      });
      tlsSocket.on('error', () => {});
    });
    socket.on('error', () => {});
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    handshakes: () => handshakes,
    close: async () => new Promise((resolve) => server.close(resolve)),
  };
}

async function connect(
  host: string,
  port: number,
  ssl: ReturnType<typeof makePgSslOptions>,
) {
  const client = new pg.Client({ host, port, user: 'u', password: 'p', ssl });
  client.on('error', () => {});
  try {
    await client.connect();
    return undefined;
  } catch (e) {
    return e as NodeJS.ErrnoException;
  } finally {
    await client.end().catch(() => {});
  }
}

describe('makePgSslOptions', () => {
  let server: Awaited<ReturnType<typeof startFakeTlsPostgres>>;
  beforeEach(async () => {
    server = await startFakeTlsPostgres();
  });
  afterEach(async () => server.close());

  it('rejects an untrusted certificate by default', async () => {
    const err = await connect(
      '127.0.0.1',
      server.port,
      makePgSslOptions({ enabled: true }),
    );
    expect(err?.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(server.handshakes()).toBe(0);
  });

  it('accepts a certificate from the configured CA', async () => {
    await connect(
      '127.0.0.1',
      server.port,
      makePgSslOptions({ enabled: true, caPath: fixture('ca.pem') }),
    );
    expect(server.handshakes()).toBe(1);
  });

  it('rejects a trusted certificate for another host in verify-full', async () => {
    const err = await connect(
      'localhost',
      server.port,
      makePgSslOptions({ enabled: true, caPath: fixture('ca.pem') }),
    );
    expect(err?.code).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
  });

  it('accepts a trusted certificate for another host in verify-ca', async () => {
    await connect(
      'localhost',
      server.port,
      makePgSslOptions({
        enabled: true,
        mode: 'verify-ca',
        caPath: fixture('ca.pem'),
      }),
    );
    expect(server.handshakes()).toBe(1);
  });

  it('rejects a certificate that does not chain to the CA in verify-ca', async () => {
    // The server certificate is not a CA, so nothing chains to it.
    const err = await connect(
      '127.0.0.1',
      server.port,
      makePgSslOptions({
        enabled: true,
        mode: 'verify-ca',
        caPath: fixture('server.pem'),
      }),
    );
    expect(err?.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(server.handshakes()).toBe(0);
  });

  it('requires a CA bundle for verify-ca', () => {
    expect(() =>
      makePgSslOptions({ enabled: true, mode: 'verify-ca' }),
    ).toThrow('DATABASE_SSL_MODE=verify-ca requires DATABASE_SSL_CA');
  });

  it('accepts the mode in any case and trims the CA path', async () => {
    await connect(
      '127.0.0.1',
      server.port,
      makePgSslOptions({
        enabled: true,
        mode: ' Verify-Full ',
        caPath: ` ${fixture('ca.pem')} `,
      }),
    );
    expect(server.handshakes()).toBe(1);
  });

  it('skips verification only in require mode', async () => {
    await connect(
      '127.0.0.1',
      server.port,
      makePgSslOptions({ enabled: true, mode: 'require' }),
    );
    expect(server.handshakes()).toBe(1);
  });

  it('rejects an unknown mode', () => {
    expect(() => makePgSslOptions({ enabled: true, mode: 'prefer' })).toThrow(
      /Invalid DATABASE_SSL_MODE/,
    );
  });

  it('returns no TLS options when disabled', () => {
    expect(makePgSslOptions({ enabled: false })).toBeUndefined();
  });

  it.each([{ mode: 'verify-full' }, { caPath: fixture('ca.pem') }])(
    'rejects %o when SSL is disabled instead of connecting without TLS',
    (opts) => {
      expect(() => makePgSslOptions({ enabled: false, ...opts })).toThrow(
        /DATABASE_SSL is not true/,
      );
    },
  );

  it('names the CA path it cannot read', () => {
    expect(() =>
      makePgSslOptions({ enabled: true, caPath: '/nonexistent/ca.pem' }),
    ).toThrow('Cannot read DATABASE_SSL_CA at /nonexistent/ca.pem');
  });

  it('rejects an empty CA bundle', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pgssl-'));
    try {
      const emptyCa = path.join(dir, 'ca.pem');
      writeFileSync(emptyCa, '\n');
      expect(() =>
        makePgSslOptions({ enabled: true, caPath: emptyCa }),
      ).toThrow('is empty');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('isPgSslEnabled', () => {
  it.each(['true', 'TRUE', ' 1 ', 'yes'])('treats %j as on', (value) => {
    expect(isPgSslEnabled(value)).toBe(true);
  });

  it.each([undefined, '', 'false', '0', 'No'])('treats %j as off', (value) => {
    expect(isPgSslEnabled(value)).toBe(false);
  });

  it.each(['on', '"true"', 'verify-full'])('rejects %j', (value) => {
    expect(() => isPgSslEnabled(value)).toThrow(/Invalid DATABASE_SSL/);
  });
});

describe('getPgConnectionParams', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('verifies certificates when DATABASE_SSL is on', () => {
    vi.stubEnv('DATABASE_SSL', 'true');
    vi.stubEnv('DATABASE_SSL_MODE', '');
    vi.stubEnv('DATABASE_SSL_CA', '');
    vi.stubEnv('DATABASE_HOST', 'db.example.com');
    vi.stubEnv('DATABASE_PASSWORD', 'p');
    expect(getPgConnectionParams().ssl).toMatchObject({
      rejectUnauthorized: true,
    });
  });

  it('rejects an unrecognised DATABASE_SSL value', () => {
    vi.stubEnv('DATABASE_SSL', 'on');
    vi.stubEnv('DATABASE_SSL_MODE', '');
    vi.stubEnv('DATABASE_SSL_CA', '');
    vi.stubEnv('DATABASE_HOST', 'db.example.com');
    vi.stubEnv('DATABASE_PASSWORD', 'p');
    expect(() => getPgConnectionParams()).toThrow(/Invalid DATABASE_SSL "on"/);
  });
});

describe('certificate verification errors', () => {
  let server: Awaited<ReturnType<typeof startFakeTlsPostgres>>;
  beforeEach(async () => {
    server = await startFakeTlsPostgres();
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await server.close();
  });

  async function queryThroughServerPool(env: Record<string, string>) {
    vi.stubEnv('DATABASE_SSL', 'true');
    vi.stubEnv('DATABASE_SSL_MODE', '');
    vi.stubEnv('DATABASE_SSL_CA', '');
    vi.stubEnv('DATABASE_HOST', '127.0.0.1');
    vi.stubEnv('DATABASE_PORT', String(server.port));
    vi.stubEnv('DATABASE_PASSWORD', 'p');
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const pool = createPgPool(getPgConnectionParams());
    try {
      await pool.query('select 1');
      return undefined;
    } catch (e) {
      return e as NodeJS.ErrnoException;
    } finally {
      await pool.end();
    }
  }

  it('names DATABASE_SSL_CA for a certificate from an unknown CA', async () => {
    const err = await queryThroughServerPool({});
    expect(err?.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(err?.message).toContain('set DATABASE_SSL_CA to its CA bundle');
    expect(err?.message).toContain('set DATABASE_SSL_MODE=require');
    expect(err?.message).toContain('deployment.html#postgres-tls');
  });

  it('names DATABASE_SSL_MODE=verify-ca for a certificate for another host', async () => {
    const err = await queryThroughServerPool({
      DATABASE_HOST: 'localhost',
      DATABASE_SSL_CA: fixture('ca.pem'),
    });
    expect(err?.code).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
    expect(err?.message).toContain(
      'set DATABASE_SSL_MODE=verify-ca and DATABASE_SSL_CA',
    );
    expect(err?.message).toContain('set DATABASE_SSL_MODE=require');
  });

  it('adds the hint when connect is awaited', async () => {
    const client = new PgClientWithSslHints({
      host: '127.0.0.1',
      port: server.port,
      user: 'u',
      password: 'p',
      ssl: makePgSslOptions({ enabled: true }),
    });
    client.on('error', () => {});
    await expect(client.connect()).rejects.toThrow(/DATABASE_SSL_CA/);
    await client.end().catch(() => {});
  });

  it.each(['CERT_HAS_EXPIRED', 'ECONNREFUSED'])(
    'leaves %s errors unchanged',
    (code) => {
      const err = Object.assign(new Error('failed'), { code });
      addPgSslHint(err);
      expect(err.message).toBe('failed');
    },
  );
});
