import { type Dependencies } from '../../iocContainer/index.js';
import { type ManualReviewToolService } from '../manualReviewToolService/manualReviewToolService.js';
import { buildSubmitReportParamsFromDecision } from './buildSubmitReportParamsFromDecision.js';
import type NcmecReporting from './ncmecReporting.js';

/** Result of a retry attempt. Distinct cases let the GraphQL layer return a
 * uniform error message for cross-org `not_found` (no information disclosure)
 * while still differentiating retryable vs permanent failures internally for
 * logging / `ncmec_reports_errors` updates. */
export type RetryNcmecSubmissionResult =
  | { kind: 'success' }
  | { kind: 'not_found' }
  | { kind: 'permanent_error'; error: string }
  | { kind: 'retryable_error'; error: string };

export interface RetryDeps {
  manualReviewToolService: ManualReviewToolService;
  ncmecReporting: NcmecReporting;
  getItemTypeEventuallyConsistent: Dependencies['getItemTypeEventuallyConsistent'];
  insertOrUpdateNcmecReportError: (opts: {
    jobId: string;
    userId: string;
    userTypeId: string;
    status: 'RETRYABLE_ERROR' | 'PERMANENT_ERROR';
    error: string;
  }) => Promise<unknown>;
}

/** Retries a previously-failed NCMEC submission for the given decision.
 *
 * Org-scoped: the caller's `orgId` is forwarded to
 * `getNcmecDecisionByIdForOrg`, which filters on `org_id` at the SQL level.
 * Cross-org callers (or callers with an unknown decisionId) get the same
 * `not_found` response — never confirm cross-org existence. */
export async function retryNcmecSubmission(
  deps: RetryDeps,
  opts: {
    orgId: string;
    decisionId: string;
    requestingReviewerId: string;
  },
): Promise<RetryNcmecSubmissionResult> {
  const { orgId, decisionId, requestingReviewerId } = opts;

  const decisionRow =
    await deps.manualReviewToolService.getNcmecDecisionByIdForOrg({
      orgId,
      decisionId,
    });
  if (!decisionRow) {
    return { kind: 'not_found' };
  }

  const submitNcmecReportComponent = decisionRow.decision_components.find(
    (c) => c.type === 'SUBMIT_NCMEC_REPORT',
  );
  if (submitNcmecReportComponent === undefined) {
    return {
      kind: 'permanent_error',
      error: 'Decision does not contain an NCMEC report component',
    };
  }
  if (decisionRow.job_payload.payload.kind !== 'NCMEC') {
    return {
      kind: 'permanent_error',
      error: 'Decision job payload is not an NCMEC payload',
    };
  }

  // Use the original reviewer when available so the resulting report keeps
  // its provenance; otherwise attribute to the user clicking Retry.
  const reviewerId = decisionRow.reviewer_id ?? requestingReviewerId;

  const itemId = decisionRow.job_payload.payload.item.itemId;
  const itemTypeIdentifier =
    decisionRow.job_payload.payload.item.itemTypeIdentifier;
  const itemTypeId = itemTypeIdentifier.id;

  const itemType = await deps.getItemTypeEventuallyConsistent({
    orgId,
    typeSelector: itemTypeIdentifier,
  });
  if (itemType === undefined || itemType.kind !== 'USER') {
    return {
      kind: 'permanent_error',
      error: 'Reported item type is missing or not a USER type',
    };
  }

  let reportParams;
  try {
    reportParams = await buildSubmitReportParamsFromDecision({
      orgId,
      reviewerId,
      reportedItemId: itemId,
      reportedItemTypeId: itemTypeId,
      reportedUserItemType: itemType,
      reportedUserData: decisionRow.job_payload.payload.item.data,
      allMediaItems: decisionRow.job_payload.payload.allMediaItems,
      decisionComponent: submitNcmecReportComponent,
      // Mirror the legacy retry-job behaviour for old DB rows that predate
      // the incidentType column.
      fallbackIncidentType:
        'Child Pornography (possession, manufacture, and distribution)',
      jobId: decisionRow.job_payload.id,
      getItemTypeEventuallyConsistent: deps.getItemTypeEventuallyConsistent,
    });
  } catch (e: unknown) {
    const error =
      e instanceof Error ? e.message : 'Failed to assemble reported media';
    return { kind: 'permanent_error', error };
  }

  const isTest = process.env.NCMEC_ENV !== 'production';
  // submitReport never throws and records its own errors via jobId; we just
  // translate the result code and upgrade UNSUPPORTED_ORG/ALL_MEDIA_MISSING
  // to PERMANENT_ERROR.
  try {
    const result = await deps.ncmecReporting.submitReport(reportParams, isTest);
    if (result === 'SUCCESS') {
      return { kind: 'success' };
    }
    try {
      await deps.insertOrUpdateNcmecReportError({
        jobId: decisionRow.job_payload.id,
        userId: itemId,
        userTypeId: itemTypeId,
        status: 'PERMANENT_ERROR',
        error: result,
      });
    } catch {
      // Already logged in the service; swallow so the user sees the NCMEC
      // error rather than a raw Postgres message.
    }
    return { kind: 'permanent_error', error: result };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { kind: 'retryable_error', error };
  }
}
