import { getSimplifiedRuleHistory } from './reportingRuleHistoryHelpers.js';

describe('reporting getSimplifiedRuleHistory', () => {
  test('filters startDate per rule and returns retained versions chronologically', async () => {
    const mockGetRawHistory = async () => [
      {
        id: 'old-seed',
        name: 'Old seed',
        exactVersion: '2025-12-09 15:40:32.761966+00',
      },
      {
        id: 'new-rule',
        name: 'New rule',
        exactVersion: '2026-08-10 00:00:00.000000+00',
      },
      {
        id: 'old-seed',
        name: 'Updated seed',
        exactVersion: '2026-08-20 00:00:00.000000+00',
      },
      {
        id: 'new-rule',
        name: 'Updated new rule',
        exactVersion: '2026-08-22 00:00:00.000000+00',
      },
    ];

    const result = await getSimplifiedRuleHistory(
      mockGetRawHistory,
      ['name'],
      undefined,
      new Date('2026-08-15T00:00:00.000Z'),
    );

    expect(
      result.map(({ id, exactVersion }) => ({ id, exactVersion })),
    ).toEqual([
      {
        id: 'old-seed',
        exactVersion: '2025-12-09 15:40:32.761966+00',
      },
      {
        id: 'new-rule',
        exactVersion: '2026-08-10 00:00:00.000000+00',
      },
      {
        id: 'old-seed',
        exactVersion: '2026-08-20 00:00:00.000000+00',
      },
      {
        id: 'new-rule',
        exactVersion: '2026-08-22 00:00:00.000000+00',
      },
    ]);
  });
});
