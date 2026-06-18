/**
 * True when `e` represents a JSON parse failure thrown by `fetchHttp` —
 * either a bare `SyntaxError` from `JSON.parse`, or the wrapper `Error`
 * that `networkingService` throws with the original `SyntaxError` as its
 * `cause`.
 */
export function isJsonParseFailure(e: unknown): boolean {
  if (e instanceof SyntaxError) {
    return true;
  }
  if (e instanceof Error && e.cause instanceof SyntaxError) {
    return true;
  }
  return false;
}
