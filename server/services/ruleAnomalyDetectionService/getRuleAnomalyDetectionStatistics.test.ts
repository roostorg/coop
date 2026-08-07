import { type Dependencies } from '../../iocContainer/index.js';
import { type MockedFn } from '../../test/mockHelpers/jestMocks.js';
import makeGetRuleAnomalyDetectionStatistics from './getRuleAnomalyDetectionStatistics.js';

/**
 * @fileoverview The testing strategy here is to just snapshot the queries
 * that our service function is generating, and run those manually to verify
 * that they work. If we update the warehouse structure, we can update the
 * snapshots and manually re-run the new queries. But having these snapshots at
 * least makes sure we can't change inadvertently change the generated queries.
 */
describe('getRuleAnomalyDetectionStatistics', () => {
  let queryMock: MockedFn<
    (
      query: string,
      tracer: unknown,
      binds?: readonly unknown[],
    ) => Promise<unknown[]>
  >;
  let getRulePassStatistics: Dependencies['getRuleAnomalyDetectionStatistics'];

  beforeAll(() => {
    // Mirror the real ClickHouse output shape: lowercase keys (CH echoes the
    // SELECT casing), `BigInt` for `Int64`/`UInt64` columns, and both
    // `DateTime64(3)` columns in CH's native string form
    // (`"YYYY-MM-DD HH:MM:SS.sss"`, no `T`, no `Z`). Mocking one of them as
    // ISO with `Z` would let the production parser silently treat the other
    // as local time and the test would still pass.
    const queryResult = [
      {
        rule_id: 'a',
        num_passes: BigInt(2),
        num_distinct_users: BigInt(1),
        num_runs: BigInt(4),
        ts_start_inclusive: '2022-05-07 23:00:00.000',
        rule_version: '2022-05-01 12:10:00.003',
      },
    ];

    // Scope of this is just the test suite, so mutation should be ok.

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jest.fn() defaults to a generic call signature; cast lets us use the typed "queryMock" declared above.
    queryMock = jest.fn() as any;
    queryMock.mockResolvedValue(queryResult);

    const dataWarehouseMock = {
      query: queryMock,
      transaction: jest.fn(),
      start: jest.fn(),
      close: jest.fn(),
      getProvider: () => 'clickhouse' as const,
    };

    // Scope of this is just the test suite, so mutation should be ok.

    getRulePassStatistics = makeGetRuleAnomalyDetectionStatistics(
      dataWarehouseMock,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the second injected arg (tracer) is unused by this code path; passing an empty object stub.
      {} as any,
    );
  });

  beforeEach(() => {
    // This is only safe while we're not running tests concurrently.
    // Consider using the `makeTestWithFixture` helper instead to make
    // a local copy of this state for each test.
    queryMock.mockClear();
  });

  test('should return the result from the warehouse, properly formatted', async () => {
    const result = await getRulePassStatistics();
    // Expected timestamps are built from fixed UTC ISO instants — the same
    // physical moment ClickHouse stored. If the production parser ever
    // reverts to interpreting CH-style strings as *local* time, this test
    // fails on any non-UTC runtime.
    expect(result).toEqual([
      {
        ruleId: 'a',
        passCount: 2,
        runsCount: 4,
        passingUsersCount: 1,
        windowStart: new Date('2022-05-07T23:00:00.000Z'),
        approxRuleVersion: new Date('2022-05-01T12:10:00.003Z'),
      },
    ]);
  });

  test('should generate the proper query when given no filters', async () => {
    await getRulePassStatistics();

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "
            SELECT
              rule_id,
              rule_version,
              num_passes,
              num_runs,
              JSONLength(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= now64(3)
            ORDER BY ts_start_inclusive DESC;",
        {},
        [],
      ]
    `);
  });

  test('should generate the proper query when given a start time filter', async () => {
    await getRulePassStatistics({ startTime: new Date('2022-05-02') });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "
            SELECT
              rule_id,
              rule_version,
              num_passes,
              num_runs,
              JSONLength(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= now64(3) AND ts_start_inclusive >= parseDateTime64BestEffort(?)
            ORDER BY ts_start_inclusive DESC;",
        {},
        [
          2022-05-02T00:00:00.000Z,
        ],
      ]
    `);
  });

  test('should generate the proper query when given a ruleIds filter', async () => {
    await getRulePassStatistics({ ruleIds: ['1', '2'] });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "
            SELECT
              rule_id,
              rule_version,
              num_passes,
              num_runs,
              JSONLength(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= now64(3) AND rule_id IN (?,?)
            ORDER BY ts_start_inclusive DESC;",
        {},
        [
          "1",
          "2",
        ],
      ]
    `);
    await getRulePassStatistics({ ruleIds: ['1'] });

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1]).toMatchInlineSnapshot(`
      [
        "
            SELECT
              rule_id,
              rule_version,
              num_passes,
              num_runs,
              JSONLength(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= now64(3) AND rule_id IN (?)
            ORDER BY ts_start_inclusive DESC;",
        {},
        [
          "1",
        ],
      ]
    `);
  });

  test('should generate the proper query when given both filters', async () => {
    await getRulePassStatistics({
      ruleIds: ['1', '2'],
      startTime: new Date('2022-05-02 23:00:00.00-04'),
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "
            SELECT
              rule_id,
              rule_version,
              num_passes,
              num_runs,
              JSONLength(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= now64(3) AND ts_start_inclusive >= parseDateTime64BestEffort(?) AND rule_id IN (?,?)
            ORDER BY ts_start_inclusive DESC;",
        {},
        [
          2022-05-03T03:00:00.000Z,
          "1",
          "2",
        ],
      ]
    `);
  });
});
