import { v1 as uuidv1 } from 'uuid';

import getBottle from '../../../iocContainer/index.js';
import { makeTestWithFixture } from '../../../test/utils.js';
import JobPriorityWeights from './JobPriorityWeights.js';

// JobPriorityWeights talks only to manual_review_tool.job_priority_weights,
// which has no foreign keys -- so the fixture just spins up the ops class
// and a unique org id. No need to seed an org row.
describe('JobPriorityWeights', () => {
  const testWithFixtures = makeTestWithFixture(async () => {
    const container = (await getBottle()).container;
    const pgQuery = container.KyselyPg;
    const ops = new JobPriorityWeights(pgQuery);
    const orgId = uuidv1();

    return {
      ops,
      pgQuery,
      orgId,
      async cleanup() {
        await pgQuery
          .deleteFrom('manual_review_tool.job_priority_weights')
          .where('org_id', '=', orgId)
          .execute();
      },
    };
  });

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
        // Postgres `numeric` comes back from node-postgres as a string;
        // the ops layer must convert so callers get plain `number` math.
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
      async ({ ops, pgQuery, orgId }) => {
        const otherOrgId = uuidv1();
        try {
          await ops.upsertForOrg(otherOrgId, [
            { property: 'numReports', weight: 99 },
          ]);
          await ops.upsertForOrg(orgId, [{ property: 'userScore', weight: 1 }]);

          const mine = await ops.loadForOrg(orgId);
          expect(mine.size).toBe(1);
          expect(mine.get('userScore')).toBe(1);
          expect(mine.has('numReports')).toBe(false);
        } finally {
          await pgQuery
            .deleteFrom('manual_review_tool.job_priority_weights')
            .where('org_id', '=', otherOrgId)
            .execute();
        }
      },
    );

    testWithFixtures(
      'honours a weight of 0 (the "property is off" signal)',
      async ({ ops, orgId }) => {
        // Confirms the row isn't silently dropped or coerced when the
        // admin explicitly sets a weight to zero.
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
      'inserts new rows when none exist',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [
          { property: 'numReports', weight: 10 },
          { property: 'userScore', weight: 5 },
        ]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.get('numReports')).toBe(10);
        expect(weights.get('userScore')).toBe(5);
      },
    );

    testWithFixtures(
      'updates existing rows on (org_id, property) conflict (last write wins)',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 10 }]);
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 25 }]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(1);
        expect(weights.get('numReports')).toBe(25);
      },
    );

    testWithFixtures(
      'bumps updated_at on conflict update',
      async ({ ops, pgQuery, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 10 }]);
        const before = await pgQuery
          .selectFrom('manual_review_tool.job_priority_weights')
          .select(['updated_at'])
          .where('org_id', '=', orgId)
          .where('property', '=', 'numReports')
          .executeTakeFirstOrThrow();

        // Tiny pause so timestamps can differ even on a fast machine.
        await new Promise((r) => setTimeout(r, 5));

        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 25 }]);
        const after = await pgQuery
          .selectFrom('manual_review_tool.job_priority_weights')
          .select(['updated_at'])
          .where('org_id', '=', orgId)
          .where('property', '=', 'numReports')
          .executeTakeFirstOrThrow();

        expect(after.updated_at.getTime()).toBeGreaterThan(
          before.updated_at.getTime(),
        );
      },
    );

    testWithFixtures(
      'partial overlap: only conflicting rows update, others insert fresh',
      async ({ ops, orgId }) => {
        await ops.upsertForOrg(orgId, [{ property: 'numReports', weight: 10 }]);
        await ops.upsertForOrg(orgId, [
          { property: 'numReports', weight: 25 }, // conflict -> update
          { property: 'userScore', weight: 5 }, // new -> insert
        ]);

        const weights = await ops.loadForOrg(orgId);
        expect(weights.size).toBe(2);
        expect(weights.get('numReports')).toBe(25);
        expect(weights.get('userScore')).toBe(5);
      },
    );
  });
});
