import { uid } from 'uid';

import getBottle, { type Dependencies } from '../../iocContainer/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createRule from '../../test/fixtureHelpers/createRule.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { RuleStatus } from '../moderationConfigService/index.js';
import {
  buildSimplifiedHistoryQuery,
  getSimplifiedRuleHistory,
} from './ruleHistoryService.js';

describe('RuleHistory Service', () => {
  describe('getSimplifiedRuleHistory', () => {
    let db: Dependencies['DrizzlePg'];
    beforeAll(async () => {
      const deps = await getBottle();

      // Scope of this is just the test suite, so reassignment should be ok.

      db = deps.container.DrizzlePg;
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
        "select "id", "t2"."name", "t2"."status_if_unexpired", "t2"."version"::text from (select "id", "name", "status_if_unexpired", CASE
                      WHEN lag("t1"."first_version", 1, "t1"."version")
                              OVER (PARTITION BY "t1"."id" ORDER BY "t1"."version" asc) <> "t1"."first_version"
                        THEN "t1"."version"
                      WHEN "t1"."first_version" = "t1"."version" THEN "t1"."version"
                      ELSE NULL
                    END as "version" from (select "name", "status_if_unexpired", "id", "version", first_value("version")
                  OVER (
                    PARTITION BY "id", "rule_versions"."name", "rule_versions"."status_if_unexpired"
                    ORDER BY "version" asc
                  ) as "first_version" from "rule_versions" order by "rule_versions"."version" asc) "t1") "t2" where ("t2"."version" is not null)"
      `);
    });

    const testWithRule = makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org } = await createOrg(
        {
          DrizzlePg: deps.DrizzlePg,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      const rule = await createRule(deps.DrizzlePg, org.id);
      return { rule };
    });

    testWithRule(
      'executes against rule_versions and decodes the selected columns',
      async ({ deps, rule }) => {
        const rows = await buildSimplifiedHistoryQuery(
          deps.DrizzlePg,
          ['name', 'tags', 'expirationTime', 'actionIds'],
          [rule.id],
        ).execute();

        expect(rows).toEqual([
          {
            id: rule.id,
            name: rule.name,
            tags: [],
            expirationTime: null,
            actionIds: [],
            exactVersion: expect.any(String),
          },
        ]);
        expect(Number.isNaN(new Date(rows[0].exactVersion).getTime())).toBe(
          false,
        );
      },
    );

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
        "select "id", "t2"."name", "t2"."status_if_unexpired", "t2"."version"::text from (select "id", "name", "status_if_unexpired", CASE
                      WHEN lag("t1"."first_version", 1, "t1"."version")
                              OVER (PARTITION BY "t1"."id" ORDER BY "t1"."version" asc) <> "t1"."first_version"
                        THEN "t1"."version"
                      WHEN "t1"."first_version" = "t1"."version" THEN "t1"."version"
                      ELSE NULL
                    END as "version" from (select "name", "status_if_unexpired", "id", "version", first_value("version")
                  OVER (
                    PARTITION BY "id", "rule_versions"."name", "rule_versions"."status_if_unexpired"
                    ORDER BY "version" asc
                  ) as "first_version" from "rule_versions" where "rule_versions"."id" in ($1) order by "rule_versions"."version" asc) "t1") "t2" where ("t2"."version" is not null)"
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

    test('startDate filter does not drop a newer rule when an older rule follows it in the list', async () => {
      const mockGetRawHistory = async () => [
        {
          id: 'new-rule',
          name: 'Anomaly test',
          statusIfUnexpired: RuleStatus.LIVE,
          exactVersion: '2026-08-22 21:59:40.059097+00',
        },
        {
          id: 'old-seed',
          name: 'Seed',
          statusIfUnexpired: RuleStatus.LIVE,
          exactVersion: '2025-12-09 15:40:32.761966+00',
        },
      ];

      const res = await getSimplifiedRuleHistory(
        mockGetRawHistory,
        ['name', 'statusIfUnexpired'],
        undefined,
        new Date('2026-08-15T00:00:00.000Z'),
      );

      expect(res.map((row) => row.id)).toEqual(['old-seed', 'new-rule']);
    });
  });
});
