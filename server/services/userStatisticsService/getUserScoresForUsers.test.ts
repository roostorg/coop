import { type Kysely } from 'kysely';
import { uid } from 'uid';

import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type UserStatisticsServicePg } from './dbTypes.js';
import { internalMakeUserStatisticsService } from './userStatisticsService.js';

describe('UserStatisticsService.getUserScoresForUsers', () => {
  const testWithFixtures = makeTransactionalTestWithFixture(
    async ({ deps }) => {
      const pgQuery = deps.KyselyPg as Kysely<UserStatisticsServicePg>;
      const sut = internalMakeUserStatisticsService(
        pgQuery,
        pgQuery,
        undefined as never,
        undefined as never,
        undefined as never,
      );
      const orgId = uid();
      const insertScore = async (row: {
        orgId?: string;
        userId: string;
        typeId: string;
        score: number;
      }) =>
        pgQuery
          .insertInto('user_statistics_service.user_scores')
          .values({
            org_id: row.orgId ?? orgId,
            user_id: row.userId,
            user_type_id: row.typeId,
            score: row.score,
          })
          .execute();
      return { sut, orgId, insertScore };
    },
  );

  testWithFixtures(
    'returns scores keyed by type and id for the requested users',
    async ({ sut, orgId, insertScore }) => {
      await insertScore({ userId: 'u1', typeId: 't1', score: 2 });
      await insertScore({ userId: 'u2', typeId: 't2', score: 4 });

      const scores = await sut.getUserScoresForUsers({
        orgId,
        users: [
          { id: 'u1', typeId: 't1' },
          { id: 'u2', typeId: 't2' },
        ],
      });

      expect(scores.size).toBe(2);
      expect(scores.get('t1\x00u1')).toBe(2);
      expect(scores.get('t2\x00u2')).toBe(4);
    },
  );

  testWithFixtures(
    'leaves out users with no score row',
    async ({ sut, orgId, insertScore }) => {
      await insertScore({ userId: 'u1', typeId: 't1', score: 2 });

      const scores = await sut.getUserScoresForUsers({
        orgId,
        users: [
          { id: 'u1', typeId: 't1' },
          { id: 'missing', typeId: 't1' },
        ],
      });

      expect([...scores.keys()]).toEqual(['t1\x00u1']);
    },
  );

  testWithFixtures(
    'matches id and type together, not each separately',
    async ({ sut, orgId, insertScore }) => {
      await insertScore({ userId: 'u1', typeId: 't2', score: 1 });
      await insertScore({ userId: 'u2', typeId: 't1', score: 1 });

      const scores = await sut.getUserScoresForUsers({
        orgId,
        users: [
          { id: 'u1', typeId: 't1' },
          { id: 'u2', typeId: 't2' },
        ],
      });

      expect(scores.size).toBe(0);
    },
  );

  testWithFixtures(
    'does not return rows from other orgs',
    async ({ sut, orgId, insertScore }) => {
      await insertScore({
        orgId: uid(),
        userId: 'u1',
        typeId: 't1',
        score: 1,
      });

      const scores = await sut.getUserScoresForUsers({
        orgId,
        users: [{ id: 'u1', typeId: 't1' }],
      });

      expect(scores.size).toBe(0);
    },
  );

  testWithFixtures(
    'handles more users than one query chunk',
    async ({ sut, orgId, insertScore }) => {
      const users = Array.from({ length: 1_001 }, (_, i) => ({
        id: `u${i}`,
        typeId: 't1',
      }));
      await insertScore({ userId: 'u0', typeId: 't1', score: 1 });
      await insertScore({ userId: 'u1000', typeId: 't1', score: 3 });

      const scores = await sut.getUserScoresForUsers({ orgId, users });

      expect(scores.get('t1\x00u0')).toBe(1);
      expect(scores.get('t1\x00u1000')).toBe(3);
      expect(scores.size).toBe(2);
    },
  );
});
