/** Pure helpers that decide which NCMEC decisions still need a submission, and
 * in which mode. They live in their own file (no deps on the wider service
 * container) so they can be unit-tested without DB clients or the IoC bottle.
 * The retry job and the failed-submissions dashboard both use them, so the
 * two always agree on what counts as submitted. */

/** Per-user summary of the reports used by the matching rules below. */
export type NcmecUserReportSummary = {
  orgId: string;
  userId: string;
  userItemTypeId: string;
  /** The user has a report whose is_test is false or null. */
  hasProductionReport: boolean;
  /** Latest test report that isn't linked to a decision (written before
   * reports recorded their job id). */
  latestUnlinkedTestReportAt: Date | null;
};

export type NcmecReportCoverage = {
  /** Job ids that have a report of their own, in either mode. */
  reportedJobIds: ReadonlySet<string>;
  users: readonly NcmecUserReportSummary[];
};

export type NcmecDecisionKey = {
  jobId: string;
  orgId: string;
  userId: string;
  userItemTypeId: string;
  decidedAt: Date;
};

// NUL never appears in real ids, so ('a','bc') and ('ab','c') stay distinct.
const userKey = (k: {
  orgId: string;
  userId: string;
  userItemTypeId: string;
}) => `${k.orgId}\u0000${k.userId}\u0000${k.userItemTypeId}`;

/** Returns the decisions that no report covers. A decision is covered when:
 * - it has a report of its own (matched by job id), in either mode; or
 * - its user has a production report. submitReport refuses a second
 *   production report for a user, so retrying would only fail again; or
 * - its user has an unlinked test report made at or after the decision. This
 *   only applies to reports written before reports recorded their job id. */
export function filterDecisionsToUnreported<D extends NcmecDecisionKey>(
  decisions: readonly D[],
  coverage: NcmecReportCoverage,
): D[] {
  const usersByKey = new Map(coverage.users.map((u) => [userKey(u), u]));
  return decisions.filter((d) => {
    if (coverage.reportedJobIds.has(d.jobId)) {
      return false;
    }
    const user = usersByKey.get(userKey(d));
    if (user === undefined) {
      return true;
    }
    if (user.hasProductionReport) {
      return false;
    }
    return !(
      user.latestUnlinkedTestReportAt != null &&
      user.latestUnlinkedTestReportAt >= d.decidedAt
    );
  });
}

export type NcmecAttemptModeMatch = 'MATCH' | 'MISMATCH' | 'UNKNOWN';

/** Compares the mode of a decision's latest failed attempt with the
 * deployment's current mode. UNKNOWN means no attempt mode is recorded: no
 * error row, or one written before error rows stored their mode. */
export function matchAttemptMode(
  attemptIsTest: boolean | null | undefined,
  currentIsTest: boolean,
): NcmecAttemptModeMatch {
  if (attemptIsTest == null) {
    return 'UNKNOWN';
  }
  return attemptIsTest === currentIsTest ? 'MATCH' : 'MISMATCH';
}

/** Whether the retry job may resubmit a decision. A decision is only retried
 * in the mode it was attempted in. With no recorded mode, only test mode
 * retries it, so nothing reaches the production endpoint automatically
 * unless it was first attempted there. */
export function canRetryAutomatically(
  attemptIsTest: boolean | null | undefined,
  currentIsTest: boolean,
): boolean {
  const match = matchAttemptMode(attemptIsTest, currentIsTest);
  return match === 'MATCH' || (match === 'UNKNOWN' && currentIsTest);
}

/** Whether a reviewer's Retry may resubmit a decision. Only a recorded
 * attempt in the other mode blocks it: a test-mode decision is never sent to
 * production by Retry, and vice versa. */
export function canRetryManually(
  attemptIsTest: boolean | null | undefined,
  currentIsTest: boolean,
): boolean {
  return matchAttemptMode(attemptIsTest, currentIsTest) !== 'MISMATCH';
}
