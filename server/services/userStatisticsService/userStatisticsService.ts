/**
 * @fileoverview This file is the public entrypoint for our user statistics
 * service.
 */
import { type ItemIdentifier } from '@roostorg/types';
import { sql, type Kysely } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type PolicyActionPenalties } from '../policyActionPenalties.js';
import { initialUserScore, type UserScore } from './computeUserScore.js';
import {
  type UserStatisticsServicePg,
  type UserStatisticsServiceWarehouse,
} from './dbTypes.js';
import {
  makeFetchUserActionStatistics,
  type UserActionStatistics,
} from './fetchUserActionStatistics.js';
import {
  makeFetchUserSubmissionStatistics,
  type UserSubmissionStatistics,
} from './fetchUserSubmissionStatistics.js';

// NB: This function -- which is exported both from this file and from index.js,
// and is used for constructing the UserStatisticsService from the outside world
// -- doesn't allow the caller to provide a custom implementation for
// `fetchUserActionStatistics` or `fetchUserSubmissionStatistics`, because
// customizing those isn't part of the user statistics service's public API.
// That's mostly because any implementation other than the one hardcoded below
// wouldn't work irl: those functions read data from specific warehouse tables
// which other methods in this service also depend on (e.g.,
// `refreshUserScoresCache`), so any alternate implementation would lead to
// inconsistent data between methods. However, the
// `internalMakeUserStatisticsService` function defined in this file, which is
// exported here but is _not_ exported from index.js, does make those arguments
// customizable, so that we can replace them with mocks in the tests.
function makeUserStatisticsService(
  pgQuery: Kysely<UserStatisticsServicePg>,
  pgQueryReplica: Kysely<UserStatisticsServicePg>,
  dialect: Dependencies['DataWarehouseDialect'],
  _tracer: Dependencies['Tracer'],
) {
  const warehouseQuery =
    dialect.getKyselyInstance() as Kysely<UserStatisticsServiceWarehouse>;
  return internalMakeUserStatisticsService(
    pgQuery,
    pgQueryReplica,
    warehouseQuery,
    makeFetchUserActionStatistics(dialect),
    makeFetchUserSubmissionStatistics(dialect),
  );
}

export function internalMakeUserStatisticsService(
  _pgQuery: Kysely<UserStatisticsServicePg>,
  pgQueryReplica: Kysely<UserStatisticsServicePg>,
  warehouseQuery: Kysely<UserStatisticsServiceWarehouse>,
  _fetchUserActionStatistics: ReturnType<typeof makeFetchUserActionStatistics>,
  _fetchUserSubmissionStatistics: ReturnType<
    typeof makeFetchUserSubmissionStatistics
  >,
) {
  return {
    /**
     * Gets a user's score from the "user scores cache", which is the postgres
     * table that stores recent (but not necessarily fully up-to-date) scores.
     */
    async getUserScore(orgId: string, userItemIdentifier: ItemIdentifier) {
      const { score } = (await pgQueryReplica
        .selectFrom('user_statistics_service.user_scores')
        .select('score')
        .where('org_id', '=', orgId)
        .where('user_type_id', '=', userItemIdentifier.typeId)
        .where('user_id', '=', userItemIdentifier.id)
        .executeTakeFirst()) ?? { score: initialUserScore };

      return score as UserScore;
    },

    async handleUsersWithChangedScores(
      _consumerId: string,
      _cb: (
        changedUsers: { userId: string; userTypeId: string; orgId: string }[],
      ) => Promise<void>,
    ) {
      // Previously consumed warehouse streams on USER_SCORES; disabled until
      // replaced with a warehouse-agnostic change feed.
    },

    async refreshUserScoresCache(
      _getActionPenalties: (
        orgId: string,
      ) => Promise<ReadonlyDeep<PolicyActionPenalties[]>>,
    ) {
      // Previously consumed warehouse streams on SUBMISSION_STATS; disabled until
      // replaced with a warehouse-agnostic incremental refresh.
    },

    async getUserActionCountsByPolicy(
      orgId: string,
      userItemIdentifier: ItemIdentifier,
    ) {
      return warehouseQuery
        .selectFrom('USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS')
        .select([
          'ACTION_ID as actionId',
          'POLICY_ID as policyId',
          'ACTOR_ID as actorId',
          'COUNT as count',
          'ITEM_SUBMISSION_IDS as itemSubmissionIds',
        ])
        .where('ORG_ID', '=', orgId)
        .where('USER_TYPE_ID', '=', userItemIdentifier.typeId)
        .where(sql`LOWER(USER_ID)`, '=', userItemIdentifier.id.toLowerCase())
        .execute();
    },

    async getUserSubmissionCount(
      orgId: string,
      userItemIdentifier: ItemIdentifier,
    ) {
      return warehouseQuery
        .selectFrom('USER_STATISTICS_SERVICE.SUBMISSION_STATS')
        .select([
          'ITEM_TYPE_ID as itemTypeId',
          warehouseQuery.fn.sum<number>('NUM_SUBMISSIONS').as('count'),
        ])
        .where('ORG_ID', '=', orgId)
        .where('USER_TYPE_ID', '=', userItemIdentifier.typeId)
        .where(sql`LOWER(USER_ID)`, '=', userItemIdentifier.id.toLowerCase())
        .groupBy('ITEM_TYPE_ID')
        .execute();
    },
  };
}

export type UserStatisticsService = ReturnType<
  typeof makeUserStatisticsService
>;

export default inject(
  [
    'KyselyPg',
    'KyselyPgReadReplica',
    'DataWarehouseDialect',
    'Tracer',
  ],
  makeUserStatisticsService,
);

export type { UserActionStatistics, UserSubmissionStatistics, UserScore };
