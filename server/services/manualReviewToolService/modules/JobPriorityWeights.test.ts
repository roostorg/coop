import { uid } from 'uid';

import createOrg from '../../../test/fixtureHelpers/createOrg.js';
import { makeTransactionalTestWithFixture } from '../../../test/harness/transactionalTest.js';
import JobPriorityWeights from './JobPriorityWeights.js';

describe('JobPriorityWeights', () => {
  const testWithFixtures = makeTransactionalTestWithFixture(
    async ({ deps }) => {
      const pgQuery = deps.KyselyPg;
      const { org } = await createOrg(
        {
          KyselyPg: pgQuery,
          ModerationConfigService: deps.ModerationConfigService,
          ApiKeyService: deps.ApiKeyService,
        },
        uid(),
      );
      return {
        ops: new JobPriorityWeights(pgQuery),
        pgQuery,
        orgId: org.id,
        mrtService: deps.ManualReviewToolService,
      };
    },
  );

  describe('loadForOrg', () => {
    testWithFixtures(
      'returns an empty Map when no rows exist for the org',
      async ({ ops, orgId }) => {
        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(0);
      },
    );

    testWithFixtures(
      'returns the org rows as a Map keyed by property',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [
          { property: 'numReports', weight: 10 },
          { property: 'userScore', weight: 5 },
        ]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(2);
        expect(weights.get('numReports')).toBe(10);
        expect(weights.get('userScore')).toBe(5);
      },
    );

    testWithFixtures(
      'converts the pg numeric column to a JS number',
      async ({ ops, orgId }) => {
        // Postgres `numeric` comes back from node-postgres as a string; the
        // ops layer must convert so callers get plain `number` math.
        await ops.upsertForOrg(orgId, [
          { property: 'numReports', weight: 7.5 },
        ]);

        const weights = await ops.loadForOrg(orgId);
        const value = weights.get('numReports');
        expect(typeof value).toBe('number');
        expect(value).toBe(7.5);
      },
    );

    testWithFixtures(
      'does not return rows from other orgs',
      async ({ ops, orgId, deps }) => {
        const { org: otherOrg } = await createOrg(
          {
            KyselyPg: deps.KyselyPg,
            ModerationConfigService: deps.ModerationConfigService,
            ApiKeyService: deps.ApiKeyService,
          },
          uid(),
        );
        await ops.upsertForOrg(otherOrg.id, [
          { property: 'numReports', weight: 99 },
        ]);
        await ops.upsertForOrg(orgId, [{ property: 'userScore', weight: 1 }]);

        const mine = await ops.loadForOrg(orgId);
        expect(mine.size).toBe(1);
        expect(mine.get('userScore')).toBe(1);
        expect(mine.has('numReports')).toBe(false);
      },
    );

    testWithFixtures(
      'honours a weight of 0 (the "property is off" signal)',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 0 }]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.get('numReports')).toBe(0);
      },
    );
  });

  describe('upsertForOrg', () => {
    testWithFixtures(
      'is a no-op for an empty weights array',
      async ({ ops, pgQuery, orgId }) => {
        await ops.upsertForOrg(orgId, []);
        const rows = await pgQuery
          .selectFrom('manual_review_tool.job_priority_weights')
          .selectAll()
          .where('org_id', '=', orgId)
          .execute();
        expect(rows).toEqual([]);
      },
    );

    testWithFixtures(
      'updates existing rows on (org_id, property) conflict',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 10 }]);
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 25 }]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(1);
        expect(weights.get('numReports')).toBe(25);
      },
    );

    testWithFixtures(
      'partial overlap: conflicting rows update, others insert fresh',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 10 }]);
        await ops.upsertForOrg(orgId, [
          { property: 'numReports', weight: 25 },
          { property: 'userScore', weight: 5 },
        ]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(2);
        expect(weights.get('numReports')).toBe(25);
        expect(weights.get('userScore')).toBe(5);
      },
    );
  });

  // Validation lives at the service boundary so GraphQL and internal callers
  // get the same protection.
  describe('ManualReviewToolService.setJobPriorityWeights', () => {
    testWithFixtures(
      'rejects negative weights',
      async ({ mrtService, orgId }) => {
        await expect(
          mrtService.setJobPriorityWeights({
            orgId,
            weights: [{ property: 'numReports', weight: -1 }],
          }),
        ).rejects.toMatchObject({ name: 'BadRequestError' });
      },
    );

    testWithFixtures(
      'rejects non-finite weights',
      async ({ mrtService, orgId }) => {
        for (const weight of [Number.NaN, Number.POSITIVE_INFINITY]) {
          await expect(
            mrtService.setJobPriorityWeights({
              orgId,
              weights: [{ property: 'numReports', weight }],
            }),
          ).rejects.toMatchObject({ name: 'BadRequestError' });
        }
      },
    );

    testWithFixtures(
      'rejects duplicate properties in one request',
      async ({ mrtService, orgId }) => {
        await expect(
          mrtService.setJobPriorityWeights({
            orgId,
            weights: [
              { property: 'numReports', weight: 1 },
              { property: 'numReports', weight: 2 },
            ],
          }),
        ).rejects.toMatchObject({ name: 'BadRequestError' });
      },
    );

    testWithFixtures(
      'persists valid weights',
      async ({ mrtService, orgId }) => {
        await mrtService.setJobPriorityWeights({
          orgId,
          weights: [
            { property: 'numReports', weight: 3 },
            { property: 'userScore', weight: 2 },
          ],
        });

        const weights = await mrtService.getJobPriorityWeights({ orgId });
        expect(weights.get('numReports')).toBe(3);
        expect(weights.get('userScore')).toBe(2);
      },
    );
  });
});
