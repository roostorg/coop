import { type ItemIdentifier } from '@roostorg/types';
import { type Kysely } from 'kysely';
import _ from 'lodash';
import { type ReadonlyDeep } from 'type-fest';

import { inject } from '../../iocContainer/index.js';
import { type UserStatisticsServiceSnowflake } from './dbTypes.js';

export type UserActionStatistics = {
  userId: string;
  userTypeId: string;
  orgId: string;
  actionId: string;
  policyId: string | null;
  actorId: string | null;
  itemSubmissionIds: string[];
  count: number;
};

const { chunk, uniqBy } = _;

/**
 * This is an internal function for querying a batch of users' lifetime action
 * statistics from Snowflake. It's not called directly by consumers of the user
 * statistics service; instead, it's used by the service internally to freshen
 * the cache that serves consumers' requests.
 *
 * @internal
 */
export const makeFetchUserActionStatistics = inject(
  ['KyselySnowflake'],
  (snowflake: Kysely<UserStatisticsServiceSnowflake>) =>
    async (
      opts: ReadonlyDeep<{
        orgId: string;
        userItemIdentifiers: ItemIdentifier[];
      }>,
    ): Promise<UserActionStatistics[]> => {
      const { orgId, userItemIdentifiers } = opts;

      // Snowflake has a published limit of ~16,000 entries in a list expression
      // (like we use in our `USER_ID IN (...)` filter), so we have to chunk the
      // user ids. Snowflake also has a published limit of 1MB for the total
      // length of the query (which must also coopr the size bind parameter
      // values). However, we were getting Snowflake errors in practice well
      // below these limits, for not-totally-clear reasons. So, we set the limit
      // here to the biggest chunk size that worked reliably.
      const uniqUserItemIdentifiers = uniqBy(
        userItemIdentifiers,
        (it) => `${it.id}:${it.typeId}`,
      );
      const userItemIdentifierBatches = chunk(uniqUserItemIdentifiers, 1000);

      const makeQueryForBatch = (userItemIdentifiers: ItemIdentifier[]) =>
        snowflake
          .selectFrom('USER_STATISTICS_SERVICE.LIFETIME_ACTION_STATS')
          .select([
            'USER_ID as userId',
            'USER_TYPE_ID as userTypeId',
            'ACTION_ID as actionId',
            'POLICY_ID as policyId',
            'ITEM_SUBMISSION_IDS as itemSubmissionIds',
            'ACTOR_ID as actorId',
            'COUNT as count',
          ])
          .where('ORG_ID', '=', orgId)
          .where(({ eb, and, or }) =>
            or(
              userItemIdentifiers.map((itemIdentifier) =>
                and([
                  eb('USER_ID', '=', itemIdentifier.id),
                  eb('USER_TYPE_ID', '=', itemIdentifier.typeId),
                ]),
              ),
            ),
          );

      const results = await Promise.all(
        userItemIdentifierBatches.map(async (it) =>
          makeQueryForBatch(it)
            .execute()
            .then((results) => results.map((it) => ({ ...it, orgId }))),
        ),
      );

      return results.flat();
    },
);
