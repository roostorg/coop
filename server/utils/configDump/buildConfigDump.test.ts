import stringify from 'safe-stable-stringify';

import { buildConfigDump } from './buildConfigDump.js';
import { REDACTED } from './redact.js';

const baseOpts = {
  now: new Date('2026-10-27T12:00:00.000Z'),
  nodeVersion: 'v24.0.0',
  platform: 'linux-x64',
  integrationPackages: [],
  appVersion: null,
  checkoutCommit: null,
};

describe('buildConfigDump', () => {
  test('reports env values, defaults and unset keys with their source', () => {
    const { config } = buildConfigDump({
      ...baseOpts,
      env: { DATABASE_HOST: 'db.internal', DATABASE_PORT: '6543' },
    });

    expect(config.postgres.DATABASE_HOST).toEqual({
      value: 'db.internal',
      set: true,
      source: 'env',
    });
    expect(config.postgres.DATABASE_PORT).toEqual({
      value: '6543',
      set: true,
      source: 'env',
    });
    expect(config.postgres.DATABASE_POOL_MAX).toEqual({
      value: '30',
      set: false,
      source: 'default',
    });
    expect(config.postgres.DATABASE_READ_ONLY_HOST).toEqual({
      value: null,
      set: false,
      source: 'default',
    });
  });

  test('shows that a secret is set without showing its value', () => {
    const { config } = buildConfigDump({
      ...baseOpts,
      env: { DATABASE_PASSWORD: 'hunter2', REDIS_PASSWORD: '' },
    });

    expect(config.postgres.DATABASE_PASSWORD).toEqual({
      value: REDACTED,
      set: true,
      source: 'env',
      redacted: true,
    });
    expect(config.redis.REDIS_PASSWORD).toEqual({
      value: '',
      set: true,
      source: 'env',
    });
    expect(config.scylla.SCYLLA_PASSWORD).toEqual({
      value: null,
      set: false,
      source: 'default',
    });
  });

  test('reports values the code derives from other settings', () => {
    const { config } = buildConfigDump({
      ...baseOpts,
      env: {
        DATA_WAREHOUSE_PROVIDER: 'postgresql',
        SCYLLA_HOSTS: 'scylla-1:9042, scylla-2:9042',
      },
    });

    expect(config.warehouse.WAREHOUSE_ADAPTER).toEqual({
      value: 'postgresql',
      set: false,
      source: 'derived',
    });
    expect(config.warehouse.ANALYTICS_ADAPTER).toEqual({
      value: 'postgresql',
      set: false,
      source: 'derived',
    });
    expect(config.scylla.SCYLLA_SSL_SERVERNAME).toEqual({
      value: 'scylla-1:9042',
      set: false,
      source: 'derived',
    });
  });

  test('never outputs env vars outside the catalog', () => {
    const dump = buildConfigDump({
      ...baseOpts,
      env: { UNRELATED_VAR: 'leaked-value', AWS_SECRET_ACCESS_KEY: 'x' },
    });

    const output = stringify(dump);
    expect(output).not.toContain('UNRELATED_VAR');
    expect(output).not.toContain('leaked-value');
    expect(output).not.toContain('AWS_SECRET_ACCESS_KEY');
  });

  test('never outputs any secret from a realistic production environment', () => {
    const secrets = [
      'pg-Pa55word!',
      'sess-1b2c3d4e5f',
      'ch-secret',
      'SG.abcdef.ghijkl',
      'redis-pw',
      'scylla-pw',
      'AIzaSyA-places-key',
      'Bearer otel-ingest-token',
    ];
    const output = stringify(
      buildConfigDump({
        ...baseOpts,
        env: {
          DATABASE_PASSWORD: secrets[0],
          SESSION_SECRET: secrets[1],
          CLICKHOUSE_PASSWORD: secrets[2],
          SENDGRID_API_KEY: secrets[3],
          REDIS_PASSWORD: secrets[4],
          SCYLLA_PASSWORD: secrets[5],
          GOOGLE_PLACES_API_KEY: secrets[6],
          OTEL_EXPORTER_OTLP_HEADERS: `Authorization=${secrets[7]}`,
          HMA_SERVICE_URL: 'https://hma:hma-pw@hma.internal:9876/',
        },
      }),
    );

    for (const secret of [...secrets, 'hma-pw']) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain(`https://hma:${REDACTED}@hma.internal:9876/`);
  });

  test('reports app, runtime and plugin metadata', () => {
    const dump = buildConfigDump({
      ...baseOpts,
      env: { BUILD_ID: '0123456789abcdef0123456789abcdef01234567' },
      appVersion: '1.2.0',
      checkoutCommit: 'fedcba9876543210fedcba9876543210fedcba98',
      integrationPackages: [
        'git+https://deploy-token@github.com/acme/coop-plugin.git',
        '@roostorg/coop-integration-example',
      ],
    });

    expect(dump).toMatchObject({
      schema_version: 1,
      generated_at: '2026-10-27T12:00:00.000Z',
      app: {
        name: 'coop',
        version: '1.2.0',
        commit: '0123456789abcdef0123456789abcdef01234567',
      },
      runtime: { node: 'v24.0.0', platform: 'linux-x64' },
      plugins: [
        '@roostorg/coop-integration-example',
        `git+https://${REDACTED}@github.com/acme/coop-plugin.git`,
      ],
    });
  });

  test('redacts a commit that does not look like a git sha', () => {
    expect(
      buildConfigDump({
        ...baseOpts,
        env: { BUILD_ID: 'https://ci:ci-token@ci.example.com/build/7' },
      }).app.commit,
    ).toBe(`https://ci:${REDACTED}@ci.example.com/build/7`);
  });

  test('falls back to the checkout commit when no commit env var is set', () => {
    const checkoutCommit = 'fedcba9876543210fedcba9876543210fedcba98';
    for (const env of [{}, { BUILD_ID: '' }]) {
      expect(
        buildConfigDump({ ...baseOpts, env, checkoutCommit }).app.commit,
      ).toBe(checkoutCommit);
    }
    expect(buildConfigDump({ ...baseOpts, env: {} }).app.commit).toBeNull();
  });
});
