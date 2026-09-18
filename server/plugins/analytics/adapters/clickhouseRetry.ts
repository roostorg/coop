import { withRetries } from '../../../utils/misc.js';

/**
 * How hard to retry a failed insert. Supplied by the caller rather than read
 * from the environment, so adapters under `plugins/` stay independent of how a
 * given deployment sources its configuration.
 */
export interface ClickhouseInsertRetrySettings {
  maxRetries: number;
  initialTimeMsBetweenRetries: number;
  maxTimeMsBetweenRetries: number;
}

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
  retry: ClickhouseInsertRetrySettings,
): (...args: Args) => Promise<void> {
  return withRetries(
    { ...retry, isRetryableError: isTransientNetworkError },
    fn,
  );
}
