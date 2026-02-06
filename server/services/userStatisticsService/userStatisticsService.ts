/**
 * @fileoverview This file is the public entrypoint for our user statistics
 * service.
 */
import { type ItemIdentifier } from '@roostorg/types';
import { sql, type Kysely } from 'kysely';
import _ from 'lodash';
import pLimit from 'p-limit';
import { type ReadonlyDeep } from 'type-fest';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { type PolicyActionPenalties } from '../../models/OrgModel.js';
import {
  makeHandleSnowflakeTableChanges,
  type handleSnowflakeTableChanges,
} from '../../snowflake/handleTableChanges.js';
import { jsonParse, jsonStringify, type JsonOf } from '../../utils/encoding.js';
import {
  computeUserScore,
  initialUserScore,
  type UserScore,
} from './computeUserScore.js';
import {
  type UserStatisticsServicePg,
  type UserStatisticsServiceSnowflake,
} from './dbTypes.js';
import {
  makeFetchUserActionStatistics,
  type UserActionStatistics,
} from './fetchUserActionStatistics.js';
import {
  makeFetchUserSubmissionStatistics,
  type UserSubmissionStatistics,
} from './fetchUserSubmissionStatistics.js';

const { groupBy, chunk } = _;

// NB: This function -- which is exported both from this file and from index.js,
// and is used for constructing the UserStatisticsService from the outside world
// -- doesn't allow the caller to provide a custom implementation for
// `fetchUserActionStatistics` or `fetchUserSubmissionStatistics`, because
// customizing those isn't part of the user statistics service's public API.
// That's mostly because any implementation other than the one hardcoded below
// wouldn't work irl: those functions read data from specific tables in
// Snowflake which other methods in this service also depend on (e.g.,
// `refreshUserScoresCache`), so any alternate implementation would lead to
// inconsistent data between methods. However, the
// `internalMakeUserStatisticsService` function defined in this file, which is
// exported here but is _not_ exported from index.js, does make those arguments
// customizable, so that we can replace them with mocks in the tests.
function makeUserStatisticsService(
  pgQuery: Kysely<UserStatisticsServicePg>,
  pgQueryReplica: Kysely<UserStatisticsServicePg>,
  snowflakeQuery: Kysely<UserStatisticsServiceSnowflake>,
  tracer: Dependencies['Tracer'],
) {
  const handleSnowflakeTableChanges = makeHandleSnowflakeTableChanges(tracer);
  return internalMakeUserStatisticsService(
    pgQuery,
    pgQueryReplica,
    snowflakeQuery,
    handleSnowflakeTableChanges,
    makeFetchUserActionStatistics(snowflakeQuery),
    makeFetchUserSubmissionStatistics(snowflakeQuery),
  );
}

export function internalMakeUserStatisticsService(
  pgQuery: Kysely<UserStatisticsServicePg>,
  pgQueryReplica: Kysely<UserStatisticsServicePg>,
  snowflakeQuery: Kysely<UserStatisticsServiceSnowflake>,
  handleSnowflakeTableChanges: handleSnowflakeTableChanges,
  fetchUserActionStatistics: ReturnType<typeof makeFetchUserActionStatistics>,
  fetchUserSubmissionStatistics: ReturnType<
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
      consumerId: string,
      cb: (
        changedUsers: { userId: string; userTypeId: string; orgId: string }[],
      ) => Promise<void>,
    ) {
      await handleSnowflakeTableChanges<
        'USER_SCORES',
        'USER_STATISTICS_SERVICE',
        UserStatisticsServiceSnowflake,
        { userId: string; userTypeId: string; orgId: string }
      >(
        snowflakeQuery,
        consumerId,
        { table: 'USER_SCORES', schema: 'USER_STATISTICS_SERVICE' },
        (builder) =>
          builder
            .select([
              'USER_ID as userId',
              'USER_TYPE_ID as userTypeId',
              'ORG_ID as orgId',
            ])
            .distinct(),
        cb,
      );
    },

    async refreshUserScoresCache(
      getActionPenalties: (
        orgId: string,
      ) => Promise<ReadonlyDeep<PolicyActionPenalties[]>>,
    ) {
      const limited = pLimit(8);
      const consumerId = 'user_scores_updater';
      await handleSnowflakeTableChanges<
        'SUBMISSION_STATS',
        'USER_STATISTICS_SERVICE',
        UserStatisticsServiceSnowflake,
        { USER_ID: string; USER_TYPE_ID: string; ORG_ID: string }
      >(
        snowflakeQuery,
        consumerId,
        { table: 'SUBMISSION_STATS', schema: 'USER_STATISTICS_SERVICE' },
        (builder) =>
          builder.select(['USER_ID', 'USER_TYPE_ID', 'ORG_ID']).distinct(),
        async (
          changedUsers: readonly {
            USER_ID: string;
            USER_TYPE_ID: string;
            ORG_ID: string;
          }[],
        ) => {
          const usersByOrgId = groupBy(changedUsers, (it) => it.ORG_ID);
          const newScores = (
            await Promise.all(
              Object.entries(usersByOrgId).map(async ([orgId, rowsForOrg]) => {
                const userItemIdentifiers = rowsForOrg.map((it) => ({
                  id: it.USER_ID,
                  typeId: it.USER_TYPE_ID,
                }));
                const [actionStats, submissionStats, actionPenalties] =
                  await Promise.all([
                    fetchUserActionStatistics({ userItemIdentifiers, orgId }),
                    fetchUserSubmissionStatistics({
                      userItemIdentifiers,
                      orgId,
                    }),
                    // Some orgs in snowflake no longer exist in pg
                    // (specifically test orgs etc), so we wanna make sure not
                    // to throw on those.
                    getActionPenalties(orgId).catch((_e) => []),
                  ]);

                const actionStatsByUserItemIdentifier = groupBy(
                  actionStats,
                  (it) =>
                    jsonStringify({
                      id: it.userId,
                      typeId: it.userTypeId,
                    }),
                );

                const submissionStatsByUserItemIdentifier = groupBy(
                  submissionStats,
                  (it) =>
                    jsonStringify({
                      id: it.userId,
                      typeId: it.userTypeId,
                    }),
                );

                return Object.keys(submissionStatsByUserItemIdentifier).map(
                  (jsonItemIdentifier) => {
                    // This cast happens because lodash's groupBy function doesn't
                    // know that all the keys in the jsonItemIdentifier JSON string
                    // are indeed ItemIdentifiers, even though we explicitly validate
                    // that above when we call jsonStringify<ItemIdentifier>(...).
                    // That generic type is not preserved by the groupBy function.
                    const { id, typeId } = jsonParse(
                      jsonItemIdentifier as JsonOf<ItemIdentifier>,
                    );
                    return {
                      orgId,
                      userId: id,
                      userTypeId: typeId,
                      score: computeUserScore(
                        submissionStatsByUserItemIdentifier[jsonItemIdentifier],
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        actionStatsByUserItemIdentifier[jsonItemIdentifier] ??
                          [],
                        actionPenalties,
                      ),
                    };
                  },
                );
              }),
            )
          ).flat();

          const now = new Date();
          const newScoresChunked = chunk(newScores, 16_000);
          await pgQuery.transaction().execute(async (trx) => {
            await Promise.all(
              newScoresChunked.map(async (scoresChunk) =>
                limited(async () =>
                  trx
                    .insertInto('user_statistics_service.user_scores')
                    .values(
                      scoresChunk.map((it) => ({
                        score: it.score,
                        user_id: it.userId,
                        user_type_id: it.userTypeId,
                        org_id: it.orgId,
                      })),
                    )
                    .onConflict((oc) =>
                      oc
                        .columns(['user_id', 'user_type_id', 'org_id'])
                        .doUpdateSet({
                          score: (eb) => eb.ref('excluded.score'),
                        }),
                    )
                    .execute(),
                ),
              ),
            );
          });

          await Promise.all(
            newScoresChunked.map(async (scoresChunk) =>
              limited(async () =>
                snowflakeQuery
                  .insertInto('USER_STATISTICS_SERVICE.USER_SCORES')
                  .values(
                    scoresChunk.map((it) => ({
                      USER_ID: it.userId,
                      USER_TYPE_ID: it.userTypeId,
                      ORG_ID: it.orgId,
                      SCORE: it.score,
                      SCORE_DATE: now,
                    })),
                  )
                  .execute(),
              ),
            ),
          );
        },
      );
    },

    async getUserActionCountsByPolicy(
      orgId: string,
      userItemIdentifier: ItemIdentifier,
    ) {
      return snowflakeQuery
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
      return snowflakeQuery
        .selectFrom('USER_STATISTICS_SERVICE.SUBMISSION_STATS')
        .select([
          'ITEM_TYPE_ID as itemTypeId',
          snowflakeQuery.fn.sum<number>('NUM_SUBMISSIONS').as('count'),
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
    'KyselySnowflake',
    'Tracer',
  ],
  makeUserStatisticsService,
);

export type { UserActionStatistics, UserSubmissionStatistics, UserScore };
