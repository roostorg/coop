import { endOfDay, startOfDay } from 'date-fns';

import {
  filterCountsInTimeWindow,
  getDecisionTimingFields,
  getPreviousInclusiveTimeWindow,
  RECENT_DECISIONS_CSV_HEADERS,
} from './mrtAnalyticsUtils';

describe('getPreviousInclusiveTimeWindow', () => {
  test('keeps equal inclusive duration and includes midnight buckets at both starts', () => {
    const timeWindow = {
      start: startOfDay(new Date('2026-08-16T12:00:00.000Z')),
      end: endOfDay(new Date('2026-08-22T12:00:00.000Z')),
    };
    const previous = getPreviousInclusiveTimeWindow(timeWindow);

    expect(previous.end.getTime()).toBe(timeWindow.start.getTime() - 1);
    expect(previous.end.getTime() - previous.start.getTime()).toBe(
      timeWindow.end.getTime() - timeWindow.start.getTime(),
    );

    const buckets = [
      { date: previous.start, count: 1 },
      { date: timeWindow.start, count: 2 },
    ];
    expect(
      filterCountsInTimeWindow(buckets, previous)?.map((b) => b.count),
    ).toEqual([1]);
    expect(
      filterCountsInTimeWindow(buckets, timeWindow)?.map((b) => b.count),
    ).toEqual([2]);
  });
});

describe('getDecisionTimingFields', () => {
  const createdAt = '2026-08-22T12:00:10.000Z';
  const assignedAt = '2026-08-22T12:00:00.000Z';
  const jobCreatedAt = '2026-08-22T11:59:00.000Z';

  test('returns empty timings when there is no claim', () => {
    expect(
      getDecisionTimingFields({
        createdAt,
        assignedAt: null,
        jobCreatedAt,
      }),
    ).toEqual({ handleTimeSeconds: '', waitTimeSeconds: '' });
  });

  test('computes handle time from claim to decision', () => {
    expect(
      getDecisionTimingFields({
        createdAt,
        assignedAt,
      }),
    ).toEqual({ handleTimeSeconds: 10, waitTimeSeconds: '' });
  });

  test('computes wait and handle time when both timestamps exist', () => {
    expect(
      getDecisionTimingFields({
        createdAt,
        assignedAt,
        jobCreatedAt,
      }),
    ).toEqual({ handleTimeSeconds: 10, waitTimeSeconds: 60 });
  });

  test('leaves handle time empty for auto-close and swept rows (no assignedAt)', () => {
    expect(
      getDecisionTimingFields({
        createdAt,
        assignedAt: null,
        jobCreatedAt: null,
      }),
    ).toEqual({ handleTimeSeconds: '', waitTimeSeconds: '' });
  });

  test('keeps CSV header order for timing columns', () => {
    expect(RECENT_DECISIONS_CSV_HEADERS).toEqual([
      'Decisions',
      'Policies',
      'Reviewer',
      'Queue',
      'Job Created At',
      'Claimed At',
      'Decision Time',
      'Wait Time (sec)',
      'Handle Time (sec)',
      'Decision Reason',
      'Link',
    ]);
  });
});
