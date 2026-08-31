/**
 * Fallback used while `passwordRequirements` is loading or if the query
 * fails, so forms don't briefly accept a password shorter than the server
 * will actually allow. Kept in sync with the server default in
 * `server/services/userManagementService/constants.ts`.
 */
export const DEFAULT_MIN_PASSWORD_LENGTH = 8;
