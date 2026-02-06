import { randomUUID } from 'crypto';
import { Kysely, type CompiledQuery, type QueryResult } from 'kysely';

import { makeMockSnowflakeDialect } from '../../snowflake/KyselyDialect.mock.js';
import { type MockedFn } from '../../test/mockHelpers/jestMocks.js';
import { safePick } from '../../utils/misc.js';
import { makeFetchUserSubmissionStatistics } from './fetchUserSubmissionStatistics.js';

describe('fetchUserSubmissionStatistics', () => {
  let snowflakeMock: MockedFn<
    (it: CompiledQuery) => Promise<QueryResult<unknown>>
  >;
  let sut: ReturnType<typeof makeFetchUserSubmissionStatistics>;

  beforeEach(() => {
    // This mutation is safe (while we're not running tests concurrently) as
    // it's local to the test suite. Consider using the `makeTestWithFixture`
    // helper instead to make a local copy of this state for each test.
    // eslint-disable-next-line better-mutation/no-mutation
    snowflakeMock = jest.fn(async (_it) => Promise.resolve({ rows: [] }));

    // This mutation is safe (while we're not running tests concurrently) as
    // it's local to the test suite. Consider using the `makeTestWithFixture`
    // helper instead to make a local copy of this state for each test.
    // eslint-disable-next-line better-mutation/no-mutation
    sut = makeFetchUserSubmissionStatistics(
      new Kysely({ dialect: makeMockSnowflakeDialect(snowflakeMock) }),
    );
  });

  test('should generate proper query given org + user ids only', async () => {
    await sut({ orgId: 'x', userItemIdentifiers: [{ id: '1', typeId: 'a' }] });
    await sut({
      orgId: 'x',
      userItemIdentifiers: [
        { id: '1', typeId: 'a' },
        { id: '3', typeId: 'b' },
      ],
    });

    expect(snowflakeMock).toHaveBeenCalledTimes(2);

    const queriesRan = snowflakeMock.mock.calls.map((it) =>
      safePick(it[0], ['parameters', 'sql']),
    );

    expect(queriesRan).toMatchInlineSnapshot(`
      [
        {
          "parameters": [
            "x",
            "1",
            "a",
          ],
          "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ITEM_TYPE_ID" as "itemTypeId", sum("NUM_SUBMISSIONS") as "numSubmissions" from "USER_STATISTICS_SERVICE"."SUBMISSION_STATS" where "ORG_ID" = :1 and ("USER_ID" = :2 and "USER_TYPE_ID" = :3) group by "USER_ID", "USER_TYPE_ID", "ITEM_TYPE_ID"",
        },
        {
          "parameters": [
            "x",
            "1",
            "a",
            "3",
            "b",
          ],
          "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ITEM_TYPE_ID" as "itemTypeId", sum("NUM_SUBMISSIONS") as "numSubmissions" from "USER_STATISTICS_SERVICE"."SUBMISSION_STATS" where "ORG_ID" = :1 and (("USER_ID" = :2 and "USER_TYPE_ID" = :3) or ("USER_ID" = :4 and "USER_TYPE_ID" = :5)) group by "USER_ID", "USER_TYPE_ID", "ITEM_TYPE_ID"",
        },
      ]
    `);
  });

  test('should batch queries of more than 16,000 unique user ids', async () => {
    const numUserIds = Math.floor(16_000 / Math.max(Math.random(), 0.05)); // some big int over 16,000
    const largeUserIdList = Array.from({ length: numUserIds }, (_) => ({
      id: randomUUID(),
      typeId: randomUUID(),
    }));

    await sut({ orgId: 'x', userItemIdentifiers: largeUserIdList });
    expect(snowflakeMock.mock.calls.length).toBeGreaterThan(1);
  });

  test('should generate proper query given user/org ids + date filters', async () => {
    await sut({
      orgId: 'x',
      userItemIdentifiers: [{ id: '1', typeId: 'a' }],
      startTime: new Date('2020-01-01T00:00Z'),
    });

    await sut({
      orgId: 'x',
      userItemIdentifiers: [
        { id: '1', typeId: 'a' },
        { id: '3', typeId: 'b' },
      ],
      endTime: new Date('2020-01-01T00:00:00Z'),
    });

    await sut({
      orgId: 'x',
      userItemIdentifiers: [
        { id: '1', typeId: 'a' },
        { id: '3', typeId: 'b' },
      ],
      endTime: new Date('2020-01-01T00:00:00Z'),
      startTime: new Date('2020-02-01T00:00:00Z'),
    });

    expect(snowflakeMock).toHaveBeenCalledTimes(3);

    const queriesRan = snowflakeMock.mock.calls.map((it) =>
      safePick(it[0], ['parameters', 'sql']),
    );

    expect(queriesRan).toMatchInlineSnapshot(`
      [
        {
          "parameters": [
            "x",
            "1",
            "a",
            2020-01-01T00:00:00.000Z,
          ],
          "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ITEM_TYPE_ID" as "itemTypeId", sum("NUM_SUBMISSIONS") as "numSubmissions" from "USER_STATISTICS_SERVICE"."SUBMISSION_STATS" where "ORG_ID" = :1 and ("USER_ID" = :2 and "USER_TYPE_ID" = :3) and "TS_START_INCLUSIVE" >= :4 group by "USER_ID", "USER_TYPE_ID", "ITEM_TYPE_ID"",
        },
        {
          "parameters": [
            "x",
            "1",
            "a",
            "3",
            "b",
            2020-01-01T00:00:00.000Z,
          ],
          "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ITEM_TYPE_ID" as "itemTypeId", sum("NUM_SUBMISSIONS") as "numSubmissions" from "USER_STATISTICS_SERVICE"."SUBMISSION_STATS" where "ORG_ID" = :1 and (("USER_ID" = :2 and "USER_TYPE_ID" = :3) or ("USER_ID" = :4 and "USER_TYPE_ID" = :5)) and "TS_END_EXCLUSIVE" <= :6 group by "USER_ID", "USER_TYPE_ID", "ITEM_TYPE_ID"",
        },
        {
          "parameters": [
            "x",
            "1",
            "a",
            "3",
            "b",
            2020-02-01T00:00:00.000Z,
            2020-01-01T00:00:00.000Z,
          ],
          "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ITEM_TYPE_ID" as "itemTypeId", sum("NUM_SUBMISSIONS") as "numSubmissions" from "USER_STATISTICS_SERVICE"."SUBMISSION_STATS" where "ORG_ID" = :1 and (("USER_ID" = :2 and "USER_TYPE_ID" = :3) or ("USER_ID" = :4 and "USER_TYPE_ID" = :5)) and "TS_START_INCLUSIVE" >= :6 and "TS_END_EXCLUSIVE" <= :7 group by "USER_ID", "USER_TYPE_ID", "ITEM_TYPE_ID"",
        },
      ]
    `);
  });
});
