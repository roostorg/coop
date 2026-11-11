import {
  canRetryAutomatically,
  canRetryManually,
  filterDecisionsToUnreported,
  type NcmecReportCoverage,
  type NcmecUserReportSummary,
} from './ncmecSubmissionFilters.js';

const DECIDED_AT = new Date('2026-11-01T12:00:00Z');

const decision = (
  overrides: Partial<{ jobId: string; userId: string }> = {},
) => ({
  jobId: 'job-1',
  orgId: 'org-1',
  userId: 'user-1',
  userItemTypeId: 'type-1',
  decidedAt: DECIDED_AT,
  ...overrides,
});

const userSummary = (
  overrides: Partial<NcmecUserReportSummary> = {},
): NcmecUserReportSummary => ({
  orgId: 'org-1',
  userId: 'user-1',
  userItemTypeId: 'type-1',
  hasProductionReport: false,
  latestUnlinkedTestReportAt: null,
  ...overrides,
});

const coverage = (
  overrides: Partial<NcmecReportCoverage> = {},
): NcmecReportCoverage => ({
  reportedJobIds: new Set(),
  users: [],
  ...overrides,
});

const minutes = (n: number) => new Date(DECIDED_AT.getTime() + n * 60_000);

describe('filterDecisionsToUnreported', () => {
  it.each([
    ['no report at all', coverage(), true],
    ['its own report', coverage({ reportedJobIds: new Set(['job-1']) }), false],
    [
      "another decision's report on the same user",
      coverage({ reportedJobIds: new Set(['job-2']) }),
      true,
    ],
    [
      'a production report on the user',
      coverage({ users: [userSummary({ hasProductionReport: true })] }),
      false,
    ],
    [
      'an unlinked test report made after the decision',
      coverage({
        users: [userSummary({ latestUnlinkedTestReportAt: minutes(1) })],
      }),
      false,
    ],
    [
      'an unlinked test report made before the decision',
      coverage({
        users: [userSummary({ latestUnlinkedTestReportAt: minutes(-1) })],
      }),
      true,
    ],
    [
      'a production report on a different item type with the same user id',
      coverage({
        users: [
          userSummary({ userItemTypeId: 'type-2', hasProductionReport: true }),
        ],
      }),
      true,
    ],
    [
      'a production report on the same user id in another org',
      coverage({
        users: [userSummary({ orgId: 'org-2', hasProductionReport: true })],
      }),
      true,
    ],
  ])('a decision with %s is unreported: %s', (_, cov, unreported) => {
    expect(filterDecisionsToUnreported([decision()], cov)).toHaveLength(
      unreported ? 1 : 0,
    );
  });

  it('keeps the extra fields of each decision', () => {
    const d = { ...decision(), row: { id: 'd1' } };
    expect(filterDecisionsToUnreported([d], coverage())).toEqual([d]);
  });
});

describe('attempt mode checks', () => {
  // [attempt mode, current mode is test, automatic retry, manual retry]
  it.each([
    [true, true, true, true],
    [false, false, true, true],
    [true, false, false, false],
    [false, true, false, false],
    [null, true, true, true],
    [null, false, false, true],
  ])(
    'attempt is_test=%s, current test mode=%s: automatic=%s manual=%s',
    (attemptIsTest, currentIsTest, automatic, manual) => {
      expect(canRetryAutomatically(attemptIsTest, currentIsTest)).toBe(
        automatic,
      );
      expect(canRetryManually(attemptIsTest, currentIsTest)).toBe(manual);
    },
  );
});
