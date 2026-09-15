import { describe, expect, it } from 'vitest';

import { selectManualReviewJob } from './selectManualReviewJob';

describe('selectManualReviewJob', () => {
  const closedJob = { id: 'closed' };
  const queriedJob = { id: 'queried', videoUrl: 'fresh' };
  const dequeuedJob = { id: 'dequeued', videoUrl: 'stored' };

  it('uses a closed job when provided', () => {
    expect(selectManualReviewJob({ closedJob, queriedJob, dequeuedJob })).toBe(
      closedJob,
    );
  });

  it('uses refreshed query data after dequeue', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        queriedJob,
        dequeuedJob,
      }),
    ).toBe(queriedJob);
  });

  it('uses dequeue data until the query returns', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        queriedJob: undefined,
        dequeuedJob,
      }),
    ).toBe(dequeuedJob);
  });

  it('returns undefined when no job is available', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        queriedJob: undefined,
        dequeuedJob: undefined,
      }),
    ).toBeUndefined();
  });
});
