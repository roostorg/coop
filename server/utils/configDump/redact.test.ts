import { isSensitiveKey, redactConfigValue, REDACTED } from './redact.js';

// Built at runtime so the repo doesn't contain strings that secret scanners
// flag as real credentials.
const RANDOM_TOKEN = 'a8Fk2LmQ9xZr4TbV7nWc1YpE6sHd3GjU0oKi5RqN';
const JWT = [
  'eyJhbGciOiJIUzI1NiJ9',
  'eyJzdWIiOiIxMjM0In0',
  'c2lnbmF0dXJl',
].join('.');
const PEM = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA',
  '-----END PRIVATE KEY-----',
].join('\n');

describe('isSensitiveKey', () => {
  test.each([
    'SESSION_SECRET',
    'DATABASE_PASSWORD',
    'REDIS_PASSWD',
    'DB_PWD',
    'SENDGRID_API_KEY',
    'GOOGLE_PLACES_APIKEY',
    'GROQ_SECRET_KEY',
    'SLACK_APP_BEARER_TOKEN',
    'GITHUB_TOKENS',
    'AWS_ACCESSKEY',
    'GCP_CREDENTIALS',
    'AUTH_ENABLED',
    'SENTRY_DSN',
    'TLS_PRIVATE_KEY',
    'CLIENT_CERT',
    'SIGNING_KEY',
    'HASH_SALT',
    'COOKIE_DOMAIN',
    'ALERTS_WEBHOOK_URL',
    'OTEL_EXPORTER_OTLP_HEADERS',
    'clientApiKey',
    'privateKey',
    'jwt-secret',
    'smtp.password',
    'sslpassword',
    'DBPASSWORD',
    'OAUTH_CLIENTSECRET',
    'GCP_SERVICE_CREDENTIALS_JSON',
  ])('%s is sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  test.each([
    'SCYLLA_KEYSPACE',
    'DATABASE_KEEPALIVE',
    'DATABASE_KEEPALIVE_INITIAL_DELAY_MS',
    'AUTHOR',
    'MONKEY',
    'KEYBOARD_LAYOUT',
    'TOKENIZER_MODEL',
    'PASSPORT_STRATEGY',
    'EXPOSE_SENSITIVE_IMPLEMENTATION_DETAILS_IN_ERRORS',
    'DATABASE_USER',
    'REDIS_HOST',
    'UI_URL',
    'NODE_ENV',
  ])('%s is not sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redactConfigValue', () => {
  test('redacts any non-empty value under a sensitive key', () => {
    expect(redactConfigValue('DATABASE_PASSWORD', 'postgres123')).toEqual({
      value: REDACTED,
      redacted: true,
    });
    expect(redactConfigValue('AUTH_ENABLED', 'true')).toEqual({
      value: REDACTED,
      redacted: true,
    });
  });

  test('passes empty values through, even under a sensitive key', () => {
    expect(redactConfigValue('REDIS_PASSWORD', '')).toEqual({
      value: '',
      redacted: false,
    });
  });

  test.each([
    ['DATABASE_HOST', 'db.internal.example.com'],
    ['PORT', '8080'],
    ['SCYLLA_ENABLED', 'true'],
    ['SCYLLA_HOSTS', '10.0.0.1:9042,10.0.0.2:9042'],
    ['UI_URL', 'https://coop.example.com/dashboard?tab=rules'],
    ['HMA_SERVICE_URL', 'http://localhost:9876/'],
    ['SUPPORT_EMAIL', 'support@example.com'],
    ['INTEGRATIONS_CONFIG_PATH', '/app/server/integrations.config.json'],
    ['SOME_PATH', '/usr/local/lib/node_modules/some_package_name/dist'],
    ['OTEL_SERVICE_NAME', 'coop-server-production-us-east-1-blue'],
    ['CLUSTER_NAME', 'my-service-name-for-the-k8s-cluster-2024'],
    ['CLICKHOUSE_MAX_BYTES_BEFORE_EXTERNAL_SORT', '1500000000'],
    ['SOME_ID', 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH'],
    ['OTEL_RESOURCE_ATTRIBUTES', 'deployment.environment=prod,team=tns'],
  ])('keeps the safe value of %s', (key, value) => {
    expect(redactConfigValue(key, value)).toEqual({ value, redacted: false });
  });

  test('masks the password in a URL but keeps scheme, user, host, port and path', () => {
    expect(
      redactConfigValue(
        'READ_REPLICA_URL',
        'postgresql://coop:hunter2@db:5432/coop',
      ),
    ).toEqual({
      value: `postgresql://coop:${REDACTED}@db:5432/coop`,
      redacted: true,
    });
  });

  test('masks a password containing @ and : in full', () => {
    expect(
      redactConfigValue('REPLICA', 'redis://admin:p@ss:w@rd@cache:6379/0'),
    ).toEqual({
      value: `redis://admin:${REDACTED}@cache:6379/0`,
      redacted: true,
    });
  });

  test('masks a password containing / in full', () => {
    expect(
      redactConfigValue('REPLICA', 'redis://admin:pa/ss@cache:6379'),
    ).toEqual({
      value: `redis://admin:${REDACTED}@cache:6379`,
      redacted: true,
    });
  });

  test('redacts the whole value when a password hides its @ behind ? or #', () => {
    expect(
      redactConfigValue('REPLICA', 'redis://admin:pa?ss@cache:6379'),
    ).toEqual({ value: REDACTED, redacted: true });
    expect(
      redactConfigValue('REPLICA', 'redis://admin:pa#ss@cache:6379'),
    ).toEqual({ value: REDACTED, redacted: true });
  });

  test('masks sensitive pairs in key-value strings', () => {
    expect(
      redactConfigValue(
        'CONNECTION',
        'Server=db;User Id=coop;Password=x;Port=1',
      ),
    ).toEqual({
      value: `Server=db;User Id=coop;Password=${REDACTED};Port=1`,
      redacted: true,
    });
    expect(redactConfigValue('SETTING', 'token=abc')).toEqual({
      value: `token=${REDACTED}`,
      redacted: true,
    });
  });

  test('masks userinfo that has no password, as it is often a bare token', () => {
    expect(
      redactConfigValue('REPO', 'https://ghp_abc123@github.com/org/repo.git'),
    ).toEqual({
      value: `https://${REDACTED}@github.com/org/repo.git`,
      redacted: true,
    });
  });

  test('masks credentials in every URL in a list', () => {
    expect(
      redactConfigValue('REPLICAS', 'pg://a:x@h1:5432 pg://b:y@h2:5432'),
    ).toEqual({
      value: `pg://a:${REDACTED}@h1:5432 pg://b:${REDACTED}@h2:5432`,
      redacted: true,
    });
  });

  test('masks sensitive query parameters and keeps the others', () => {
    expect(
      redactConfigValue(
        'UPSTREAM',
        'https://api.example.com/v1?region=us&api_key=abc&sslpassword=x#frag',
      ),
    ).toEqual({
      value: `https://api.example.com/v1?region=us&api_key=${REDACTED}&sslpassword=${REDACTED}#frag`,
      redacted: true,
    });
  });

  test('redacts a whole value containing a PEM block', () => {
    expect(redactConfigValue('TLS_BUNDLE', PEM)).toEqual({
      value: REDACTED,
      redacted: true,
    });
  });

  test('redacts a whole value containing a JWT', () => {
    expect(redactConfigValue('X', JWT)).toEqual({
      value: REDACTED,
      redacted: true,
    });
    expect(redactConfigValue('X', `Authorization=Bearer ${JWT}`)).toEqual({
      value: REDACTED,
      redacted: true,
    });
  });

  test('redacts high-entropy tokens on their own, in lists and in URL paths', () => {
    for (const value of [
      RANDOM_TOKEN,
      `foo,${RANDOM_TOKEN}`,
      `https://hooks.example.com/services/${RANDOM_TOKEN}`,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'k3j9x2m8q7w1z5v4b6n0p8r2t7y3u9i1o5',
      `SG.abcdEFGH1234.${RANDOM_TOKEN}`,
      `${RANDOM_TOKEN}.example.com`,
    ]) {
      expect(redactConfigValue('SOME_SETTING', value)).toEqual({
        value: REDACTED,
        redacted: true,
      });
    }
  });

  test('does not leak a high-entropy password once its URL is masked', () => {
    expect(
      redactConfigValue('CACHE', `redis://u:${RANDOM_TOKEN}@cache:6379`),
    ).toEqual({ value: `redis://u:${REDACTED}@cache:6379`, redacted: true });
  });
});
