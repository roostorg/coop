import {
  safeGetEnvInt,
  safeGetEnvNonNegativeInt,
} from '../../../iocContainer/utils.js';
import { withRetries } from '../../../utils/misc.js';

// Network errors we'll retry on. ClickHouse over HTTP can RST in-flight
// connections (remote restart, idle-socket reaper between us and CH, etc.);
// these are transient and worth one or two retries before giving up.
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
]);

export function isTransientNetworkError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('socket hang up');
}

export function withClickhouseInsertRetries<Args extends unknown[]>(
  fn: (this: void, ...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
  return withRetries(
    {
      maxRetries: safeGetEnvNonNegativeInt('CLICKHOUSE_INSERT_MAX_RETRIES', 2),
      initialTimeMsBetweenRetries: safeGetEnvInt(
        'CLICKHOUSE_INSERT_RETRY_INITIAL_MS',
        100,
      ),
      maxTimeMsBetweenRetries: safeGetEnvInt(
        'CLICKHOUSE_INSERT_RETRY_MAX_MS',
        1000,
      ),
      isRetryableError: isTransientNetworkError,
    },
    fn,
  );
}
