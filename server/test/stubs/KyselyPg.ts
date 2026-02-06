import {
  PostgresDialect,
  type PostgresCursor,
  type PostgresQueryResult,
} from 'kysely';

import { type MockedFn } from '../mockHelpers/jestMocks.js';

export type MockPgExecute = MockedFn<
  (it: {
    sql: string;
    parameters: ReadonlyArray<unknown>;
  }) => Promise<PostgresQueryResult<unknown>>
>;

export function makeMockPgDialect(executeMockFn: MockPgExecute) {
  return new PostgresDialect({
    pool: {
      async connect() {
        function query(cursor: PostgresCursor<unknown>): never;
        function query(
          sql: string,
          params: ReadonlyArray<unknown>,
        ): Promise<PostgresQueryResult<unknown>>;
        async function query(
          cursorOrSql: string | PostgresCursor<unknown>,
          parameters?: ReadonlyArray<unknown>,
        ) {
          if (typeof cursorOrSql !== 'string') {
            throw new Error('cursors not supported in fake/mock dialect');
          }
          return executeMockFn({ sql: cursorOrSql, parameters: parameters! });
        }

        return {
          query,
          async release() {},
        };
      },
      async end() {},
    },
  });
}
