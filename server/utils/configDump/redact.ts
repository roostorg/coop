/**
 * Redaction rules for the config dump (`bin/dump-config.ts`). The dump is meant
 * to be pasted into public bug reports, so these rules fail closed: a value is
 * hidden if either its key or its shape suggests it could be a secret.
 *
 * Pure functions only, so the rules can be unit tested without an environment.
 */

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_TOKENS = new Set([
  'accesskey',
  'apikey',
  'auth',
  'authentication',
  'authorization',
  'bearer',
  'cert',
  'certificate',
  'certs',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'creds',
  'dsn',
  'header',
  'headers',
  'jwt',
  'key',
  'keys',
  'passwd',
  'password',
  'passwords',
  'privatekey',
  'private',
  'pwd',
  'salt',
  'secret',
  'secretkey',
  'secrets',
  'session',
  'signing',
  'token',
  'tokens',
  'webhook',
  'webhooks',
]);

/**
 * Splits a config key into lower-case words on `_`, `-`, `.`, whitespace and
 * camelCase boundaries, e.g. `SCYLLA_KEYSPACE` -> `['scylla', 'keyspace']` and
 * `clientApiKey` -> `['client', 'api', 'key']`.
 */
function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_.-]+/)
    .filter((it) => it.length > 0)
    .map((it) => it.toLowerCase());
}

// Stems that never occur inside an innocent word, so they match anywhere in a
// word (e.g. libpq's `sslpassword`, `DBPASSWORD`, `CLIENTSECRET`).
const SENSITIVE_KEY_STEMS = [
  'apikey',
  'credential',
  'passwd',
  'password',
  'secret',
];

/**
 * True if the key names something that may hold a secret. Most words must
 * match whole, so `SCYLLA_KEYSPACE`, `DATABASE_KEEPALIVE`, `AUTHOR` and
 * `TOKENIZER_MODEL` are not sensitive, while `API_KEY`, `APIKEY` and
 * `SESSION_SECRET` are.
 */
export function isSensitiveKey(key: string): boolean {
  return keyTokens(key).some(
    (it) =>
      SENSITIVE_KEY_TOKENS.has(it) ||
      SENSITIVE_KEY_STEMS.some((stem) => it.includes(stem)),
  );
}

const PEM_PATTERN = /-----BEGIN [A-Z0-9 ]+-----/;
const JWT_PATTERN = /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*/;
const ENTROPY_CANDIDATE_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * True for strings that look like generated credentials: at least 32
 * characters of hex, of letters and digits with no separators, or of base64
 * mixing upper case, lower case and digits, and close to random. Lower-case
 * slugs such as
 * `my-service-name-for-the-k8s-cluster-2024` are as random-looking by entropy
 * alone, hence the mixed-case requirement; `.` is excluded so hostnames and
 * file paths never match.
 */
function isHighEntropyToken(token: string): boolean {
  if (token.length < 32) {
    return false;
  }
  if (/^[0-9a-f]+$/i.test(token)) {
    return /[0-9]/.test(token) && shannonEntropy(token) >= 3;
  }
  if (/^[A-Za-z0-9]+$/.test(token)) {
    // Single-case random tokens have no separators and score far higher than
    // the hyphenated slugs excluded above.
    return (
      /[A-Za-z]/.test(token) &&
      /[0-9]/.test(token) &&
      shannonEntropy(token) >= 4
    );
  }
  return (
    ENTROPY_CANDIDATE_PATTERN.test(token) &&
    /[A-Z]/.test(token) &&
    /[a-z]/.test(token) &&
    /[0-9]/.test(token) &&
    shannonEntropy(token) >= 3.5
  );
}

function looksLikeSecretValue(value: string): boolean {
  // Each token's segments are checked too, to catch secrets in URL paths
  // (`https://host/api/<token>`) and dotted keys (`SG.<id>.<secret>`) that
  // never match the base64 alphabet as a whole.
  const tokens = value
    .split(/[\s,;&=]+/)
    .flatMap((it) => [it, ...it.split(/[./?#:@]+/)]);
  return (
    PEM_PATTERN.test(value) ||
    JWT_PATTERN.test(value) ||
    tokens.some(isHighEntropyToken)
  );
}

const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s]*/gi;

/**
 * Masks the userinfo of one URL: the password in `user:password@`, or all of
 * it when there is no `:` (a bare token, as in `https://TOKEN@host`).
 * Everything up to the last `@` before the query/fragment counts as userinfo,
 * so a password containing `@` or `/` is masked whole.
 */
function maskUrlUserinfo(url: string): string {
  const schemeEnd = url.indexOf('://') + 3;
  const rest = url.slice(schemeEnd);
  const queryStart = rest.search(/[?#]/);
  const beforeQuery = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const at = beforeQuery.lastIndexOf('@');
  if (at === -1) {
    return url;
  }
  const userinfo = beforeQuery.slice(0, at);
  const colon = userinfo.indexOf(':');
  const maskedUserinfo =
    colon === -1 ? REDACTED : `${userinfo.slice(0, colon)}:${REDACTED}`;
  return `${url.slice(0, schemeEnd)}${maskedUserinfo}${rest.slice(at)}`;
}

/**
 * Masks values of sensitive `name=value` pairs, in URL query strings
 * (`?token=x`) and in key-value strings (`Server=db;Password=x`).
 */
function maskSensitiveParams(value: string): string {
  return value.replace(
    /(^|[?&;,\s])([^=?&;,#\s]+)=([^&;,#\s]*)/g,
    (match, separator: string, name: string) =>
      isSensitiveKey(name) ? `${separator}${name}=${REDACTED}` : match,
  );
}

/**
 * True if a URL still has userinfo that was not masked, e.g. because the
 * password contains `?` or `#` and so looked like the start of the query.
 */
function hasUnmaskedUserinfo(value: string): boolean {
  return (value.match(URL_PATTERN) ?? []).some((url) => {
    const at = url.lastIndexOf('@');
    return at !== -1 && !url.slice(0, at).endsWith(REDACTED);
  });
}

export type RedactionResult = {
  value: string;
  redacted: boolean;
};

/**
 * Redacts a single config value. Empty strings pass through unchanged (they
 * hide nothing and "set but empty" is useful to see). A sensitive key, or a
 * value shaped like a PEM block, JWT or random token, yields the
 * {@link REDACTED} marker. Otherwise credentials embedded in URLs and
 * sensitive `name=value` pairs are masked and the rest of the value is kept.
 */
export function redactConfigValue(key: string, value: string): RedactionResult {
  if (value === '') {
    return { value, redacted: false };
  }
  if (isSensitiveKey(key)) {
    return { value: REDACTED, redacted: true };
  }

  const masked = maskSensitiveParams(
    value.replace(URL_PATTERN, maskUrlUserinfo),
  );
  if (
    hasUnmaskedUserinfo(masked) ||
    looksLikeSecretValue(masked.split(REDACTED).join(' '))
  ) {
    return { value: REDACTED, redacted: true };
  }
  return { value: masked, redacted: masked !== value };
}
