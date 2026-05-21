import {
  retryNcmecSubmission,
  type RetryDeps,
} from './retryNcmecSubmission.js';

/** Helper that builds a `RetryDeps` mock with sensible defaults. Each test
 * overrides only the fields it cares about; everything else throws if invoked
 * unexpectedly so missing assertions surface as failures. */
function makeDeps(overrides: Partial<RetryDeps> = {}): RetryDeps {
  const fail = (name: string) => () => {
    throw new Error(`Unexpected call to ${name}`);
  };
  return {
    manualReviewToolService: {
      getNcmecDecisionByIdForOrg: fail('getNcmecDecisionByIdForOrg'),
    } as unknown as RetryDeps['manualReviewToolService'],
    ncmecReporting: {
      submitReport: fail('submitReport'),
    } as unknown as RetryDeps['ncmecReporting'],
    getItemTypeEventuallyConsistent: fail('getItemTypeEventuallyConsistent'),
    ...overrides,
  };
}

describe('retryNcmecSubmission', () => {
  // SECURITY: a decision belonging to a different org must look identical to
  // a missing decision so that callers cannot probe cross-org existence. The
  // SQL-level filter in getNcmecDecisionByIdForOrg returns undefined for
  // cross-org IDs; this test pins that behavior at the orchestration layer.
  it('returns not_found when the underlying lookup returns undefined (cross-org or missing)', async () => {
    const deps = makeDeps({
      manualReviewToolService: {
        getNcmecDecisionByIdForOrg: async () => undefined,
      } as unknown as RetryDeps['manualReviewToolService'],
    });
    const result = await retryNcmecSubmission(deps, {
      orgId: 'org-A',
      decisionId: 'decision-belonging-to-org-B',
      requestingReviewerId: 'reviewer-1',
    });
    expect(result).toEqual({ kind: 'not_found' });
  });

  it('returns permanent_error when the decision lacks an NCMEC component', async () => {
    const deps = makeDeps({
      manualReviewToolService: {
        getNcmecDecisionByIdForOrg: async () => ({
          id: 'd1',
          org_id: 'org-A',
          decision_components: [{ type: 'TAKE_USER_ACTION' }],
          job_payload: { payload: { kind: 'NCMEC' } },
          reviewer_id: 'r1',
          queue_id: 'q1',
          created_at: new Date(),
        }),
      } as unknown as RetryDeps['manualReviewToolService'],
    });
    const result = await retryNcmecSubmission(deps, {
      orgId: 'org-A',
      decisionId: 'd1',
      requestingReviewerId: 'reviewer-1',
    });
    expect(result.kind).toBe('permanent_error');
    if (result.kind === 'permanent_error') {
      expect(result.error).toMatch(/NCMEC report component/i);
    }
  });

  it('returns permanent_error when the job payload is not an NCMEC payload', async () => {
    const deps = makeDeps({
      manualReviewToolService: {
        getNcmecDecisionByIdForOrg: async () => ({
          id: 'd1',
          org_id: 'org-A',
          decision_components: [{ type: 'SUBMIT_NCMEC_REPORT' }],
          job_payload: { payload: { kind: 'OTHER' } },
          reviewer_id: 'r1',
          queue_id: 'q1',
          created_at: new Date(),
        }),
      } as unknown as RetryDeps['manualReviewToolService'],
    });
    const result = await retryNcmecSubmission(deps, {
      orgId: 'org-A',
      decisionId: 'd1',
      requestingReviewerId: 'reviewer-1',
    });
    expect(result.kind).toBe('permanent_error');
    if (result.kind === 'permanent_error') {
      expect(result.error).toMatch(/NCMEC payload/i);
    }
  });
});
