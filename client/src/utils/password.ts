/**
 * Fallback used while `passwordRequirements` is loading or if the query
 * fails, so forms don't briefly accept a password shorter than the server
 * will actually allow. Kept in sync with the server default in
 * `server/services/userManagementService/constants.ts` (15 per NIST SP
 * 800-63-4 §3.1.1).
 */
export const DEFAULT_MIN_PASSWORD_LENGTH = 15;
