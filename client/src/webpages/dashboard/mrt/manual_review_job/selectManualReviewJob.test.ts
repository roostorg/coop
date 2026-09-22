import { describe, expect, it } from 'vitest';

import { selectManualReviewJob } from './selectManualReviewJob';

const storedA = { id: 'a', videoUrl: 'stored-a' };
const refreshedA = { id: 'a', videoUrl: 'fresh-a' };
const storedB = { id: 'b', videoUrl: 'stored-b' };
const refreshedB = { id: 'b', videoUrl: 'fresh-b' };
const closedJob = { id: 'closed', videoUrl: 'historical' };

describe('selectManualReviewJob', () => {
  it('keeps closed reviews independent of dequeue state', () => {
    for (const dequeuedJob of [undefined, null, storedA]) {
      expect(
        selectManualReviewJob({
          closedJob,
          currentJobId: 'a',
          queriedJob: refreshedA,
          dequeuedJob,
        }),
      ).toBe(closedJob);
    }
  });

  it('uses the route query when no dequeue has run', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'a',
        queriedJob: refreshedA,
        dequeuedJob: undefined,
      }),
    ).toBe(refreshedA);
  });

  it('uses initial dequeue data before the route query is available', () => {
    for (const currentJobId of [undefined, 'a']) {
      expect(
        selectManualReviewJob({
          closedJob: undefined,
          currentJobId,
          queriedJob: undefined,
          dequeuedJob: storedA,
        }),
      ).toBe(storedA);
    }
  });

  it('does not select queried content before a job is claimed', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: undefined,
        queriedJob: refreshedA,
        dequeuedJob: undefined,
      }),
    ).toBeUndefined();
  });

  it('prefers refreshed content for the same active job', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'a',
        queriedJob: refreshedA,
        dequeuedJob: storedA,
      }),
    ).toBe(refreshedA);
  });

  it('does not revive the completed job after the final dequeue returns null', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'a',
        queriedJob: refreshedA,
        dequeuedJob: null,
      }),
    ).toBeUndefined();
  });

  it('moves from A to B without reusing A while B refreshes', () => {
    function select(
      currentJobId: string,
      queriedJob: typeof storedA | undefined,
      dequeuedJob: typeof storedA | null,
    ) {
      return selectManualReviewJob({
        closedJob: undefined,
        currentJobId,
        queriedJob,
        dequeuedJob,
      });
    }
    expect(select('a', refreshedA, storedA)).toBe(refreshedA);
    expect(select('b', refreshedA, storedB)).toBe(storedB);
    expect(select('b', undefined, storedB)).toBe(storedB);
    expect(select('b', refreshedB, storedB)).toBe(refreshedB);
    expect(select('b', refreshedB, null)).toBeUndefined();
  });

  it('ignores an old dequeue result when visiting another review', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'b',
        queriedJob: refreshedB,
        dequeuedJob: storedA,
      }),
    ).toBe(refreshedB);
  });

  it('does not render data for another route while loading', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'b',
        queriedJob: refreshedA,
        dequeuedJob: storedA,
      }),
    ).toBeUndefined();
  });

  it('does not show a stale mutation when the current query is empty', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: 'b',
        queriedJob: undefined,
        dequeuedJob: storedA,
      }),
    ).toBeUndefined();
  });

  it('returns undefined for an initially empty queue', () => {
    expect(
      selectManualReviewJob({
        closedJob: undefined,
        currentJobId: undefined,
        queriedJob: undefined,
        dequeuedJob: null,
      }),
    ).toBeUndefined();
  });
});
