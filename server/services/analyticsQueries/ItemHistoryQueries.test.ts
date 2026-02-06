import { Kysely, type DatabaseConnection } from 'kysely';

import { safePick } from '../../utils/misc.js';
import { getUtcDateOnlyString, WEEK_MS } from '../../utils/time.js';
import { makeMockSnowflakeDialect } from '../../snowflake/KyselyDialect.mock.js';
import { type SnowflakePublicSchema } from '../../snowflake/types.js';
import ItemHistoryQueries from './ItemHistoryQueries.js';

describe('handleSnowflakeTableChanges', () => {
  test('should issue a proper query', async () => {
    // Arrange
    const snowflakeMock = jest.fn<DatabaseConnection['executeQuery']>(
      async (_it) => ({ rows: [] }),
    );
    const dialect = makeMockSnowflakeDialect(snowflakeMock);
    const kysely = new Kysely<SnowflakePublicSchema>({ dialect });
    const dialectMock = {
      getKyselyInstance: () => kysely,
      destroy: jest.fn(),
    };
    const sut = new ItemHistoryQueries(dialectMock);

    // Act
    await sut.getItemRuleExecutionsHistory({
      itemId: 'fakeItemId',
      itemTypeId: 'fakeItemTypeId',
      orgId: 'fakeOrgId',
    });

    // Assert
    const queriesRan = snowflakeMock.mock.calls.map((it) =>
      safePick(it[0], ['parameters', 'sql']),
    );
    expect(queriesRan).toMatchInlineSnapshot(`
      [
        {
          "parameters": [
            "fakeOrgId",
            "${getUtcDateOnlyString(new Date(Date.now() - WEEK_MS))}",
            "fakeItemId",
            "fakeItemTypeId",
            "${getUtcDateOnlyString(new Date(Date.now()))}",
          ],
          "sql": "select "ds", "ts", "item_type_name" as "itemTypeName", "item_type_id" as "itemTypeId", "item_creator_id" as "userId", "item_creator_type_id" as "userTypeId", "item_data" as "content", "result" as "result", "environment" as "environment", "passed" as "passed", "rule_id" as "ruleId", "rule" as "ruleName", "policy_names" as "policies", "tags" as "tags" from analytics.RULE_EXECUTIONS as "rule_exec" where "org_id" = :1 and "ds" >= :2 and "result" is not null and "item_data" is not null and (LOWER("item_id") = LOWER(:3) and LOWER("item_type_id") = LOWER(:4) and "ds" <= :5)",
        },
      ]
    `);
  });
});
