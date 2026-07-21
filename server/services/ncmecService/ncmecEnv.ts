/**
 * Whether this deployment submits NCMEC CyberTips to the sandbox endpoint
 * (`exttest.cybertip.org`) rather than the production endpoint
 * (`report.cybertip.org`).
 *
 * Driven solely by `NCMEC_ENV`: any value other than the literal `"production"`
 * (including unset/empty) routes to the sandbox. This is a **deployment-wide**
 * property — it does not vary per report. Contrast with the per-report
 * `isTestReport` flag persisted on `ncmec_reports.is_test`, which records
 * whether an individual report row is a test submission.
 *
 * Centralising this here means endpoint selection has a single source of
 * truth; call sites no longer need to thread a sandbox boolean into
 * `submitReport` for the endpoint to be chosen correctly.
 */
export function isNcmecTestDeployment(): boolean {
  return process.env.NCMEC_ENV !== 'production';
}
