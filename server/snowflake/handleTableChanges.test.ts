import { Kysely, type DatabaseConnection } from 'kysely';

import { getBottleContainerWithIOMocks } from '../test/setupMockedServer.js';
import { safePick } from '../utils/misc.js';
import { makeMockSnowflakeDialect } from './KyselyDialect.mock.js';
import { makeHandleSnowflakeTableChanges } from './handleTableChanges.js';

describe('handleSnowflakeTableChanges', () => {
  test(
    'should create a stream for the consumer on the requested table, ' +
      'query that stream the requested columns, pass the result to the callback, ' +
      'and commit',
    async () => {
      const { Tracer } = await getBottleContainerWithIOMocks();
      // Arrange
      const snowflakeMock = jest.fn<DatabaseConnection['executeQuery']>(
        async (it) => ({
          rows: it.sql.toLowerCase().startsWith('select')
            ? [{ column1: 45 } as any]
            : [],
        }),
      );
      const dialect = makeMockSnowflakeDialect(snowflakeMock);
      const kysely = new Kysely<{
        'some_schema.some_table': { column1: unknown; column2: unknown };
      }>({ dialect });

      // Act
      const batchSize = 300;
      const handleSnowflakeTableChanges = makeHandleSnowflakeTableChanges(Tracer);

      await handleSnowflakeTableChanges(
        kysely,
        'hello',
        { table: 'some_table', schema: 'some_schema' },
        (builder) =>
          builder.select('column1').distinct().orderBy('column2', 'desc'),
        async (selection) => {
          expect(selection).toMatchInlineSnapshot(`
            [
              {
                "column1": 45,
              },
            ]
          `);
        },
        batchSize,
      );

      // Assert
      const queriesRan = snowflakeMock.mock.calls.map((it) =>
        safePick(it[0], ['parameters', 'sql']),
      );
      expect(queriesRan).toMatchInlineSnapshot(`
        [
          {
            "parameters": [],
            "sql": "
                    CREATE STREAM IF NOT EXISTS
                    "some_schema"."some_table_CONSUMER_hello_STREAM" ON TABLE "some_schema"."some_table";",
          },
          {
            "parameters": [],
            "sql": "begin",
          },
          {
            "parameters": [
              300,
              0,
            ],
            "sql": "select distinct "column1" from "some_schema"."some_table_CONSUMER_hello_STREAM" as "stream" order by "column2" desc limit :1 offset :2",
          },
          {
            "parameters": [],
            "sql": "insert into "PUBLIC"."ALL_ORGS" ("ID") select 'ignored' as "dummy" from "some_schema"."some_table_CONSUMER_hello_STREAM" as "stream" where 1 = 0",
          },
          {
            "parameters": [],
            "sql": "commit",
          },
        ]
      `);
    },
  );
});
