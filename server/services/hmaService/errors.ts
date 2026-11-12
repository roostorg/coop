/**
 * An error whose message is safe to show to the requesting user. Messages must
 * never contain credential values; name fields instead.
 */
export class HashBankUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HashBankUserError';
  }
}

/** A non-OK HMA response that isn't the user's fault. */
export class HmaRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(`${message}: status=${status}`);
    this.name = 'HmaRequestError';
  }
}
