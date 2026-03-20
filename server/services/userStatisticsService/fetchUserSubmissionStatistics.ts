import { type ItemIdentifier } from '@roostorg/types';
import { type Kysely } from 'kysely';
import _ from 'lodash';

import { inject, type Dependencies } from '../../iocContainer/index.js';
import { jsonStringify } from '../../utils/encoding.js';
import { type UserStatisticsServiceWarehouse } from './dbTypes.js';

const { chunk, uniqBy } = _;

export type UserSubmissionStatistics = {
  userId: string;
  userTypeId: string;
  orgId: string;
  itemTypeId: string;
  numSubmissions: number;
};

/**
 * This is an internal function for querying a batch of users' content
 * submission statistics from the data warehouse. It's not called directly by consumers
 * of the user statistics service; instead, it's used by the service internally
 * to freshen the cache that serves consumers' requests.
 *
 * @internal
 */
export const makeFetchUserSubmissionStatistics = inject(
  ['DataWarehouseDialect'],
  (dialect: Dependencies['DataWarehouseDialect']) => {
    const warehouseKysely =
      dialect.getKyselyInstance() as Kysely<UserStatisticsServiceWarehouse>;
    return async (opts: {
      readonly orgId: string;
      readonly userItemIdentifiers: readonly ItemIdentifier[];
      readonly startTime?: Date;
      readonly endTime?: Date;
    }): Promise<UserSubmissionStatistics[]> => {
      const { startTime, endTime, orgId } = opts;

      // The warehouse has a published limit of ~16,000 entries in a list expression
      // (like we use in our `USER_ID IN (...)` filter), so we have to chunk the
      // user ids. The warehouse also has a published limit of 1MB for the total
      // length of the query (which must also coopr the size bind parameter
      // values). However, we were getting warehouse errors in practice well
      // below these limits, for not-totally-clear reasons. So, we set the limit
      // here to the biggest chunk size that worked reliably.
      const uniqUserItemIdentifiers = uniqBy(opts.userItemIdentifiers, (a) =>
        jsonStringify([a.id, a.typeId]),
      );
      const userItemIdentifierBatches = chunk(uniqUserItemIdentifiers, 1000);

      const makeQueryForBatch = (userItemIdentifiers: ItemIdentifier[]) => {
        let query = warehouseKysely
          .selectFrom('USER_STATISTICS_SERVICE.SUBMISSION_STATS')
          .select([
            'USER_ID as userId',
            'USER_TYPE_ID as userTypeId',
            'ITEM_TYPE_ID as itemTypeId',
            // NB: we need the manual `number` type param to indicate that this
            // isn't returned as a bigint or a numeric string (it shouldn't be,
            // because a user can't possibly have that many submissions).
            warehouseKysely.fn.sum<number>('NUM_SUBMISSIONS').as('numSubmissions'),
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
          )
          .groupBy(['USER_ID', 'USER_TYPE_ID', 'ITEM_TYPE_ID']);

        if (startTime) {
          query = query.where('TS_START_INCLUSIVE', '>=', startTime);
        }

        if (endTime) {
          query = query.where('TS_END_EXCLUSIVE', '<=', endTime);
        }

        return query;
      };

      const results = await Promise.all(
        userItemIdentifierBatches.map(async (batch) =>
          makeQueryForBatch(batch)
            .execute()
            .then((results) => results.map((it) => ({ ...it, orgId }))),
        ),
      );

      return results.flat();
    };
  },
);
