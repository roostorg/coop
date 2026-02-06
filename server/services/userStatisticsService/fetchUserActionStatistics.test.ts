import { randomUUID } from 'crypto';
import {
  Kysely,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from 'kysely';

import { makeMockSnowflakeDialect } from '../../snowflake/KyselyDialect.mock.js';
import { type MockedFn } from '../../test/mockHelpers/jestMocks.js';
import { safePick } from '../../utils/misc.js';
import { makeFetchUserActionStatistics } from './fetchUserActionStatistics.js';

describe('fetchUserActionStatistics', () => {
  let snowflakeMock: MockedFn<
    (it: CompiledQuery) => Promise<QueryResult<unknown>>
  >;
  let sut: ReturnType<typeof makeFetchUserActionStatistics>;

  beforeEach(() => {
    // For these tests, configure the mock to always resolve w/ an empty query
    // result, since our code doesn't branch on the query result, and our tests
    // are just asserting what queries were issued.
    //
    // This mutation is safe (while we're not running tests concurrently) as
    // it's local to the test suite. Consider using the `makeTestWithFixture`
    // helper instead to make a local copy of this state for each test.
    // eslint-disable-next-line better-mutation/no-mutation
    snowflakeMock = jest
      .fn<DatabaseConnection['executeQuery']>()
      .mockResolvedValue({ rows: [] });

    // This mutation is safe (while we're not running tests concurrently) as
    // it's local to the test suite. Consider using the `makeTestWithFixture`
    // helper instead to make a local copy of this state for each test.
    // eslint-disable-next-line better-mutation/no-mutation
    sut = makeFetchUserActionStatistics(
      new Kysely({ dialect: makeMockSnowflakeDialect(snowflakeMock) }),
    );
  });

  test('should generate proper query given user item identifiers', async () => {
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

    expect(queriesRan[0]).toMatchInlineSnapshot(`
      {
        "parameters": [
          "x",
          "1",
          "a",
        ],
        "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ACTION_ID" as "actionId", "POLICY_ID" as "policyId", "ITEM_SUBMISSION_IDS" as "itemSubmissionIds", "ACTOR_ID" as "actorId", "COUNT" as "count" from "USER_STATISTICS_SERVICE"."LIFETIME_ACTION_STATS" where "ORG_ID" = :1 and ("USER_ID" = :2 and "USER_TYPE_ID" = :3)",
      }
    `);
    expect(queriesRan[1]).toMatchInlineSnapshot(`
      {
        "parameters": [
          "x",
          "1",
          "a",
          "3",
          "b",
        ],
        "sql": "select "USER_ID" as "userId", "USER_TYPE_ID" as "userTypeId", "ACTION_ID" as "actionId", "POLICY_ID" as "policyId", "ITEM_SUBMISSION_IDS" as "itemSubmissionIds", "ACTOR_ID" as "actorId", "COUNT" as "count" from "USER_STATISTICS_SERVICE"."LIFETIME_ACTION_STATS" where "ORG_ID" = :1 and (("USER_ID" = :2 and "USER_TYPE_ID" = :3) or ("USER_ID" = :4 and "USER_TYPE_ID" = :5))",
      }
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
});
