import { describe, expect, it } from 'vitest';

import { getPieChartData } from './ManualReviewDashboardInsightsChart';

describe('getPieChartData', () => {
  it('zeros a hidden category and restores its value without changing legend order', () => {
    const sums = { foo: 6, bar: 4 };

    expect(getPieChartData(sums, ['foo'])).toEqual([
      { name: 'foo', value: 0 },
      { name: 'bar', value: 4 },
    ]);
    expect(getPieChartData(sums, [])).toEqual([
      { name: 'foo', value: 6 },
      { name: 'bar', value: 4 },
    ]);
  });
});
