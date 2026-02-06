import { type Dependencies } from '../../iocContainer/index.js';
import { type MockedFn } from '../../test/mockHelpers/jestMocks.js';
import makeGetRuleAnomalyDetectionStatistics from './getRuleAnomalyDetectionStatistics.js';

/**
 * @fileoverview The testing strategy here is to just snapshot the queries
 * that our service function is generating, and run those manually to verify
 * that they work. If we update the snowflake structure, we can update the
 * snapshots and manually re-run the new queries. But having these snapshots at
 * least makes sure we can't change inadvertently change the generated queries.
 */
describe('getRuleAnomalyDetectionStatistics', () => {
  let queryMock: MockedFn<(query: string, tracer: any, binds?: readonly unknown[]) => Promise<unknown[]>>;
  let getRulePassStatistics: Dependencies['getRuleAnomalyDetectionStatistics'];

  beforeAll(() => {
    const queryResult = [
      {
        RULE_ID: 'a',
        NUM_PASSES: 2,
        NUM_DISTINCT_USERS: 1,
        NUM_RUNS: 4,
        TS_START_INCLUSIVE: '2022-05-07 23:00:00.00',
        RULE_VERSION: '2022-05-01T12:10:00.00305Z',
      },
    ];

    // Scope of this is just the test suite, so mutation should be ok.
    // eslint-disable-next-line better-mutation/no-mutation
    queryMock = jest.fn() as any;
    queryMock.mockResolvedValue(queryResult);

    const dataWarehouseMock = {
      query: queryMock,
      transaction: jest.fn(),
      start: jest.fn(),
      close: jest.fn(),
      getProvider: () => 'snowflake' as const,
    };

    // Scope of this is just the test suite, so mutation should be ok.
    // eslint-disable-next-line better-mutation/no-mutation
    getRulePassStatistics = makeGetRuleAnomalyDetectionStatistics(
      dataWarehouseMock,
      {} as any,
    );
  });

  beforeEach(() => {
    // This is only safe while we're not running tests concurrently.
    // Consider using the `makeTestWithFixture` helper instead to make
    // a local copy of this state for each test.
    queryMock.mockClear();
  });

  test('should return the result from snowflake, properly formatted', async () => {
    const result = await getRulePassStatistics();
    expect(result).toEqual([
      {
        ruleId: 'a',
        passCount: 2,
        runsCount: 4,
        passingUsersCount: 1,
        windowStart: new Date('2022-05-07 23:00:00.00'),
        approxRuleVersion: new Date('2022-05-01T12:10:00.00305Z'),
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
              array_size(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= SYSDATE()
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
              array_size(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= SYSDATE() AND ts_start_inclusive >= ?
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
              array_size(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= SYSDATE() AND rule_id IN (?,?)
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
              array_size(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= SYSDATE() AND rule_id IN (?)
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
              array_size(passes_distinct_user_ids) as num_distinct_users,
              ts_start_inclusive
            FROM RULE_ANOMALY_DETECTION_SERVICE.RULE_EXECUTION_STATISTICS
            WHERE ts_end_exclusive <= SYSDATE() AND ts_start_inclusive >= ? AND rule_id IN (?,?)
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
