import { Kysely, type DatabaseConnection } from 'kysely';

import { makeMockSnowflakeDialect } from '../../snowflake/KyselyDialect.mock.js';
import { type handleSnowflakeTableChanges } from '../../snowflake/handleTableChanges.js';
import {
  makeMockPgDialect,
  type MockPgExecute,
} from '../../test/stubs/KyselyPg.js';
import { type makeFetchUserActionStatistics } from './fetchUserActionStatistics.js';
import { type makeFetchUserSubmissionStatistics } from './fetchUserSubmissionStatistics.js';
import { internalMakeUserStatisticsService } from './userStatisticsService.js';

describe('UserStatisticsService', () => {
  describe('refreshUserScoresCache', () => {
    test.todo('should fetch stats w/ batching and update accordingly');

    test('should properly upsert new scores into pg', async () => {
      // Arrange.
      const snowflakeMock = jest
        .fn<DatabaseConnection['executeQuery']>()
        .mockImplementation(async (_query) => {
          return { rows: [] };
        });

      const handleSnowflakeTableChangesMock: handleSnowflakeTableChanges = async (
        _kysely,
        _consumerId,
        toWatch,
        buildQuery,
        cb,
      ) => {
        // Verify that the user is watching the expected table
        expect(toWatch).toEqual({
          schema: 'USER_STATISTICS_SERVICE',
          table: 'SUBMISSION_STATS',
        });

        // and verify that they built a query for the expected columns
        const distinctMock = jest.fn();
        const selectMock = jest
          .fn()
          .mockReturnValueOnce({ distinct: distinctMock });

        buildQuery({ select: selectMock } as any);

        expect(selectMock).toBeCalledTimes(1);
        expect(selectMock).toBeCalledWith([
          'USER_ID',
          'USER_TYPE_ID',
          'ORG_ID',
        ]);
        expect(distinctMock).toBeCalledTimes(1);

        // in which case we can pass fake rows in that shape to the cb.
        await cb([
          { USER_ID: '1', USER_TYPE_ID: 'a', ORG_ID: 'org-x' },
          { USER_ID: '2', USER_TYPE_ID: 'b', ORG_ID: 'org-x' },
        ] as unknown as Parameters<typeof cb>[0]);
      };

      const pgReadMock = jest
        .fn<MockPgExecute>()
        .mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0 });

      const pgWriteMock = jest
        .fn<MockPgExecute>()
        .mockResolvedValue({ rows: [], command: 'SELECT', rowCount: 0 });

      const fetchUserActionStatisticsMock = jest
        .fn<ReturnType<typeof makeFetchUserActionStatistics>>()
        .mockResolvedValue([
          {
            userId: '2',
            userTypeId: 'b',
            orgId: 'org-x',
            actionId: 'a',
            actorId: null,
            policyId: null,
            itemSubmissionIds: ['x'],
            count: 1,
          },
        ]);

      const fetchUserSubmissionStatisticsMock = jest
        .fn<ReturnType<typeof makeFetchUserSubmissionStatistics>>()
        .mockResolvedValue([
          {
            userId: '1',
            userTypeId: 'a',
            orgId: 'org-x',
            itemTypeId: 'a',
            numSubmissions: 5,
          },
          {
            userId: '2',
            userTypeId: 'b',
            orgId: 'org-x',
            itemTypeId: 'a',
            numSubmissions: 1,
          },
        ]);

      const sut = internalMakeUserStatisticsService(
        new Kysely({ dialect: makeMockPgDialect(pgWriteMock) }),
        new Kysely({ dialect: makeMockPgDialect(pgReadMock) }),
        new Kysely({ dialect: makeMockSnowflakeDialect(snowflakeMock) }),
        handleSnowflakeTableChangesMock,
        fetchUserActionStatisticsMock,
        fetchUserSubmissionStatisticsMock,
      );

      // Act.
      await sut.refreshUserScoresCache(async () => []);

      // Assert that it did an upsert of the new scores into pg.
      expect(pgWriteMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "parameters": [],
              "sql": "begin",
            },
          ],
          [
            {
              "parameters": [
                5,
                "1",
                "a",
                "org-x",
                5,
                "2",
                "b",
                "org-x",
              ],
              "sql": "insert into "user_statistics_service"."user_scores" ("score", "user_id", "user_type_id", "org_id") values ($1, $2, $3, $4), ($5, $6, $7, $8) on conflict ("user_id", "user_type_id", "org_id") do update set "score" = "excluded"."score"",
            },
          ],
          [
            {
              "parameters": [],
              "sql": "commit",
            },
          ],
        ]
      `);
    });
  });
});
