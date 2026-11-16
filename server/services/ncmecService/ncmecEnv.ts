/**
 * Submissions go to the NCMEC test endpoint (exttest.cybertip.org) unless the
 * deployment sets NCMEC_ENV=production. Operators must match this to whether
 * the credentials in Settings → NCMEC are production or test credentials.
 * Read at call time so tests can toggle the env var.
 */
export function isNcmecTestMode(): boolean {
  return process.env.NCMEC_ENV !== 'production';
}
