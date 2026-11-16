import { endOfDay, startOfDay } from 'date-fns';

import {
  filterCountsInTimeWindow,
  getPreviousInclusiveTimeWindow,
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
