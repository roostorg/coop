import { describe, expect, it } from 'vitest';

import { integerSort } from './sort';

type SortValue = number | string | null | undefined;

const rowWithValue = (value: SortValue) =>
  ({
    original: {
      values: {
        reports: value,
      },
    },
  }) as Parameters<typeof integerSort>[0];

describe('integerSort', () => {
  it('sorts numeric and comma-formatted values numerically', () => {
    const rows = [rowWithValue('1,000'), rowWithValue(2), rowWithValue('10')];
    const sorted = [...rows].sort((a, b) => integerSort(a, b, 'reports'));
    expect(sorted.map((row) => row.original.values.reports)).toEqual([
      2,
      '10',
      '1,000',
    ]);
  });

  it('handles null and undefined values without throwing', () => {
    expect(
      integerSort(rowWithValue(null), rowWithValue(undefined), 'reports'),
    ).toBe(0);
    expect(
      integerSort(rowWithValue(undefined), rowWithValue(2), 'reports'),
    ).toBe(-1);
  });
});
