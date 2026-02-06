import * as knexPkg from 'knex';

import { takeLast } from './sql.js';

const { knex: Knex } = knexPkg.default;

describe('Sql Helpers', () => {
  describe('takeLast', () => {
    test('should work for simple queries', () => {
      type User = { id: string; name: string; email: string };

      const knex = Knex({ dialect: 'postgres' });
      const users = knex<User>('users').select('id', 'name');

      const result = takeLast(users, [{ column: 'id', order: 'desc' }], 2);

      expect(result.toString()).toEqual(
        'select * from (select "id", "name" from "users" order by "id" asc limit 2) as "dc2d41a9-082e-48b0-a66f-345a22696b02" order by "id" desc',
      );
    });

    test('should work for arbitrarily complex queries', () => {
      // We'll test this with the real query we use for backtesting.
      // This is still only one case (notably, with no joins), but at least it
      // uses aliases and a WHERE, so it'll give us a bit more confidence.
      const knex = Knex({ dialect: 'postgres' });
      type Result = {
        orgId: string;
        ts: string;
        content: string;
        correlationId: string;
      };

      const backtestResults = knex<Result>('RULE_EXECUTIONS')
        .select({
          orgId: 'ORG_ID',
          ts: 'TS',
          content: 'CONTENT',
          correlationId: 'CORRELATION_ID',
        })
        .where('CORRELATION_ID', '=', '47')
        .andWhere('TS', '>', '2019-01-01');

      const result = takeLast(
        backtestResults,
        [{ column: 'ts', order: 'asc' }],
        50,
      );

      expect(result.toString()).toMatchInlineSnapshot(
        `"select * from (select "ORG_ID" as "orgId", "TS" as "ts", "CONTENT" as "content", "CORRELATION_ID" as "correlationId" from "RULE_EXECUTIONS" where "CORRELATION_ID" = '47' and "TS" > '2019-01-01' order by "ts" desc limit 50) as "dc2d41a9-082e-48b0-a66f-345a22696b02" order by "ts" asc"`,
      );
    });
  });
});
