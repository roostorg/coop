import {
  assertManualReviewJobIdsWithinLimit,
  MAX_MANUAL_REVIEW_JOB_IDS,
} from './manualReviewTool.js';

describe('manual review job ID limit', () => {
  it('accepts up to the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS }, (_, i) => `${i}`),
      ),
    ).not.toThrow();
  });

  it('rejects requests over the configured limit', () => {
    expect(() =>
      assertManualReviewJobIdsWithinLimit(
        Array.from({ length: MAX_MANUAL_REVIEW_JOB_IDS + 1 }, (_, i) => `${i}`),
      ),
    ).toThrow(`At most ${MAX_MANUAL_REVIEW_JOB_IDS} job IDs may be requested.`);
  });
});
