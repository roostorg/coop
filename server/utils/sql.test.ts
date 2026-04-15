import { Kysely, PostgresDialect, type PostgresQueryResult } from 'kysely';

import { takeLast } from './sql.js';

function makeCompileOnlyDb<T extends Record<string, Record<string, unknown>>>() {
  return new Kysely<T>({
    dialect: new PostgresDialect({
      pool: {
        async connect() {
          return {
            query: jest.fn().mockResolvedValue({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
            } as PostgresQueryResult<unknown>),
            async release() {},
          };
        },
        async end() {},
      },
    }),
  });
}

describe('Sql Helpers', () => {
  describe('takeLast', () => {
    test('should work for simple queries', () => {
      type User = { id: string; name: string; email: string };
      type TestDb = { users: User };

      const db = makeCompileOnlyDb<TestDb>();
      const users = db.selectFrom('users').select(['id', 'name']);

      const result = takeLast(db, users, [{ column: 'id', order: 'desc' }], 2);

      expect(result.compile().sql).toEqual(
        'select * from (select "id", "name" from "users" order by "id" asc limit $1) as "dc2d41a9-082e-48b0-a66f-345a22696b02" order by "id" desc',
      );
      expect(result.compile().parameters).toEqual([2]);
    });

    test('should work for arbitrarily complex queries', () => {
      type RuleExecRow = {
        ORG_ID: string;
        TS: string;
        CONTENT: string;
        CORRELATION_ID: string;
      };
      type TestDb = { RULE_EXECUTIONS: RuleExecRow };

      const db = makeCompileOnlyDb<TestDb>();
      const backtestResults = db
        .selectFrom('RULE_EXECUTIONS')
        .select([
          'ORG_ID as orgId',
          'TS as ts',
          'CONTENT as content',
          'CORRELATION_ID as correlationId',
        ])
        .where('CORRELATION_ID', '=', '47')
        .where('TS', '>', '2019-01-01');

      const result = takeLast(
        db,
        backtestResults,
        [{ column: 'ts', order: 'asc' }],
        50,
      );

      expect(result.compile().sql).toMatchInlineSnapshot(
        `"select * from (select "ORG_ID" as "orgId", "TS" as "ts", "CONTENT" as "content", "CORRELATION_ID" as "correlationId" from "RULE_EXECUTIONS" where "CORRELATION_ID" = $1 and "TS" > $2 order by "ts" desc limit $3) as "dc2d41a9-082e-48b0-a66f-345a22696b02" order by "ts" asc"`,
      );
      expect(result.compile().parameters).toEqual(['47', '2019-01-01', 50]);
    });
  });
});
