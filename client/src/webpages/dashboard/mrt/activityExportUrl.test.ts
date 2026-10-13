import { jsonStringify } from '../../../utils/typescript-types';
import { exportRangeProblem, toExportDecisions } from './activityExportUrl';
import { type DecisionOrAction } from './ManualReviewRecentDecisionsFilter';

describe('exportRangeProblem', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const tooLong = 'Downloads are limited to 400 days. Narrow the date range.';

  it.each([
    [undefined, 'Set a date range to download.'],
    [{}, 'Set a date range to download.'],
    [
      {
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2026-02-05T00:00:00Z'),
      },
      undefined,
    ],
    [
      {
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2026-02-06T00:00:00Z'),
      },
      tooLong,
    ],
    [{ startDate: new Date('2025-09-01T00:00:00Z') }, tooLong],
  ])('%o → %s', (range, expected) => {
    expect(exportRangeProblem(range, now)).toBe(expected);
  });
});

describe('toExportDecisions', () => {
  it('sends each picked decision as its type, with the action for custom actions', () => {
    const picked: DecisionOrAction[] = [
      { type: 'IGNORE' },
      { type: 'AUTOMATIC_CLOSE' },
      { type: 'CUSTOM_ACTION', actionId: 'act-1' },
      { type: 'ACCEPT_APPEAL', appealId: 'ap-1', actionIds: [] },
    ];

    expect(toExportDecisions(picked.map((it) => jsonStringify(it)))).toEqual([
      { type: 'IGNORE' },
      { type: 'AUTOMATIC_CLOSE' },
      { type: 'CUSTOM_ACTION', actionIds: ['act-1'] },
      { type: 'ACCEPT_APPEAL' },
    ]);
  });
});
