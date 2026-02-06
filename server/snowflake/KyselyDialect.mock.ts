import { type CompiledQuery, type QueryResult } from 'kysely';

import { type MockedFn } from '../test/mockHelpers/jestMocks.js';
import { SnowflakeDialect } from './KyselyDialect.js';

export function makeMockSnowflakeDialect(
  executeMockFn: MockedFn<(it: CompiledQuery) => Promise<QueryResult<any>>>,
) {
  const throwNotSupported = () => {
    throw new Error('not supported');
  };

  return new SnowflakeDialect({
    connection: {
      async acquireConnection() {
        return { executeQuery: executeMockFn, streamQuery: throwNotSupported };
      },
      async releaseConnection() {},
      async destroyAllResources() {},
    },
  });
}
