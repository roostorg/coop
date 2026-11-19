export const MAX_THREAD_CONTEXT_LIMIT = 100;

/** Returns an error message per invalid field of a Sentinel config. */
export function validateSentinelConfig(
  credential: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const { apiUrl, topK, minScoreToConsider } = credential;
  const { threadContextWindowMinutes, threadContextLimit } = credential;

  if (typeof apiUrl !== 'string' || apiUrl.trim() === '') {
    errors.apiUrl = 'Enter the URL of your Sentinel API.';
  } else if (!isHttpUrl(apiUrl.trim())) {
    errors.apiUrl = 'Enter a valid http:// or https:// URL.';
  }

  if (topK != null && !isPositiveInteger(topK)) {
    errors.topK = 'Enter a whole number greater than 0.';
  }
  if (
    minScoreToConsider != null &&
    !(
      typeof minScoreToConsider === 'number' &&
      minScoreToConsider >= 0 &&
      minScoreToConsider <= 1
    )
  ) {
    errors.minScoreToConsider = 'Enter a number between 0 and 1.';
  }
  if (
    threadContextWindowMinutes != null &&
    !(
      typeof threadContextWindowMinutes === 'number' &&
      threadContextWindowMinutes > 0
    )
  ) {
    errors.threadContextWindowMinutes = 'Enter a number greater than 0.';
  }
  if (
    threadContextLimit != null &&
    !(
      isPositiveInteger(threadContextLimit) &&
      threadContextLimit <= MAX_THREAD_CONTEXT_LIMIT
    )
  ) {
    errors.threadContextLimit = `Enter a whole number from 1 to ${MAX_THREAD_CONTEXT_LIMIT}.`;
  }

  return errors;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
