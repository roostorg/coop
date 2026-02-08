import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import { RuleStatus } from '../moderationConfigService/index.js';
import {
  buildSimplifiedHistoryQuery,
  getSimplifiedRuleHistory,
} from './ruleHistoryService.js';

describe('RuleHistory Service', () => {
  describe('getSimplifiedRuleHistory', () => {
    let db: Dependencies['KyselyPg'];
    beforeAll(async () => {
      const deps = await getBottle();

      // Scope of this is just the test suite, so reassignment should be ok.
      // eslint-disable-next-line better-mutation/no-mutation
      db = deps.container.KyselyPg;
    });

    test('should run the expected query', async () => {
      // TODO: until we set up a mock kysely instance that lets us spy on issued
      // queries, we'll just export a separate (should-be-internal) function
      // that builds the query, and test that.
      const { sql, parameters: bindings } = buildSimplifiedHistoryQuery(db, [
        'name',
        'statusIfUnexpired',
      ]).compile();

      expect(bindings).toEqual([]);
      expect(sql).toMatchInlineSnapshot(`
        "select "id", "name" as "name", "status_if_unexpired" as "statusIfUnexpired", version::text as "exactVersion" from (select "id", "name", "status_if_unexpired", CASE
                      WHEN lag(first_version, 1, version)
                              OVER (PARTITION BY id ORDER BY version asc) <> first_version
                        THEN version
                      WHEN first_version = version THEN version
                      ELSE NULL
                    END as "version" from (select "name", "status_if_unexpired", "id", "version", first_value(version)
                  OVER (
                    PARTITION BY id, "name", "status_if_unexpired"
                    ORDER BY version asc
                  ) as "first_version" from "rule_versions" order by "version" asc) as "t1") as "t2" where "version" is not null"
      `);
    });

    test('should support filtering by ids, startTime', async () => {
      // TODO: until we set up a mock kysely instance that lets us spy on issued
      // queries, we'll just export a separate (should-be-internal) function
      // that builds the query, and test that.
      const { sql, parameters: bindings } = buildSimplifiedHistoryQuery(
        db,
        ['name', 'statusIfUnexpired'],
        ['ruleId1'],
      ).compile();

      expect(bindings).toEqual(['ruleId1']);
      expect(sql).toMatchInlineSnapshot(`
        "select "id", "name" as "name", "status_if_unexpired" as "statusIfUnexpired", version::text as "exactVersion" from (select "id", "name", "status_if_unexpired", CASE
                      WHEN lag(first_version, 1, version)
                              OVER (PARTITION BY id ORDER BY version asc) <> first_version
                        THEN version
                      WHEN first_version = version THEN version
                      ELSE NULL
                    END as "version" from (select "name", "status_if_unexpired", "id", "version", first_value(version)
                  OVER (
                    PARTITION BY id, "name", "status_if_unexpired"
                    ORDER BY version asc
                  ) as "first_version" from "rule_versions" where "id" in ($1) order by "version" asc) as "t1") as "t2" where "version" is not null"
      `);

      const mockGetRawHistory = async () => [
        {
          id: '4fb36ec8fb0',
          name: 'Toxicity Rule (WIP)',
          statusIfUnexpired: RuleStatus.LIVE,
          exactVersion: '2022-05-04 19:00:59.556331+00',
        },
        {
          id: '4fb36ec8fb0',
          name: 'Toxicity Rule',
          statusIfUnexpired: RuleStatus.LIVE,
          exactVersion: '2022-05-11 19:00:59.556331+00',
        },
        {
          id: '4fb36ec8fb0',
          name: 'Toxicity Rule',
          statusIfUnexpired: RuleStatus.BACKGROUND,
          exactVersion: '2022-05-19 23:39:21.261444+00',
        },
      ];

      const res = await getSimplifiedRuleHistory(
        mockGetRawHistory,
        ['name', 'statusIfUnexpired'],
        ['4fb36ec8fb0'],
        new Date('2022-05-13'),
      );

      expect(res).toEqual([
        {
          id: '4fb36ec8fb0',
          name: 'Toxicity Rule',
          statusIfUnexpired: 'LIVE',
          exactVersion: '2022-05-11 19:00:59.556331+00',
          approxVersion: new Date('2022-05-11T19:00:59.556Z'),
        },
        {
          id: '4fb36ec8fb0',
          name: 'Toxicity Rule',
          statusIfUnexpired: 'BACKGROUND',
          exactVersion: '2022-05-19 23:39:21.261444+00',
          approxVersion: new Date('2022-05-19T23:39:21.261Z'),
        },
      ]);
    });
  });
});
