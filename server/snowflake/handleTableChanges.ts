import {
  sql,
  type AliasedRawBuilder,
  type Kysely,
  type Selectable,
  type SelectQueryBuilder,
  type Transaction,
} from 'kysely';
import _ from 'lodash';

import { inject } from '../iocContainer/utils.js';
import { type SnowflakePublicSchema } from './types.js';

const snowflakeIdentifierRe = /^[A-Za-z0-9_$]+$/;

// Just a helper type to abstract away a lot of kysely types that get pretty
// gnarly to have to use manually. NB: this is not totally safe, e.g., if the
// alias matches a real table's name in DbType, but it's good enough.
type SelectBuilderFor<
  DbType extends object,
  QualifiedTableName extends keyof DbType,
  TableAlias extends string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Result = {},
> = SelectQueryBuilder<
  { [K in keyof DbType]: DbType[K] } & {
    [K in TableAlias]: Selectable<DbType[QualifiedTableName]>;
  },
  keyof DbType | TableAlias,
  Result
>;

/**
 * This function provides a passed-in callback with rows selected by buildQuery
 *  _since this function was last called by the given consumer and the callback
 * resolved successfully for every batch_. Note that this could have potential side
 * effects if the callback is not idempotent since a later batch can
 * throw causing duplicate rows to be processed.
 *
 * Background: With user statistics, we have a couple different consumers that
 * want to react only to the users whose statistics have changed. E.g., the user
 * rules job wants to only run the user rules on the users whose stats have
 * changed. (This will be a tiny fraction of our organization's total users; running
 * every user rule on every user every few minutes would be wildly impractical.)
 * Similarly, we have a job that invalidates the cache of users' user scores,
 * and that needs to only compute new scores for users whose scores might have
 * actually changed.
 *
 * To accomodate these use cases, we want to have a way for consumers of the
 * user statistics service to query for the set of changed users' ids. One way
 * to do this would be to have the consumer provide a date, and the service
 * would return the ids of users that have changed _since that date_. That keeps
 * the user statistics service nice and stateless -- at the cost, of course, of
 * shifting the burden of bookkeeping to the consumers, which then would have to
 * track/store the date through which they've processed successfully.
 *
 * In principal, it's probably better to make this bookkeeping the consumer's
 * job, and not clutter up the user stats service with that state. However, for
 * now, it's much easier to have the user stats service track this state, b/c
 * it's got easy access to Snowflake, and Snowflake streams just store exactly
 * this type of metadata.
 *
 * So, instead of taking a date, the user stats service asks the consumers to
 * identify themselves with a unique, stable "consumerId" (a la consumer group
 * ids in Kafka), and then the service will take care of tracking the last
 * offset for each consumer and only returning the user ids that have changed
 * since then. That's what this function does.
 *
 * This function has no contract for what happens if multiple concurrent calls
 * are made by the same consumer.
 */
export const makeHandleSnowflakeTableChanges = inject(
  ['Tracer'],
  (tracer) =>
    async function handleSnowflakeTableChanges<
      TableName extends string,
      SchemaName extends string,
      DbType extends { [K in `${SchemaName}.${TableName}`]: object },
      QueryResult,
    >(
      snowflake: Kysely<DbType>,
      consumerId: string,
      toWatch: { readonly table: TableName; readonly schema: SchemaName },
      buildQuery: (
        builder: SelectBuilderFor<
          DbType,
          `${SchemaName}.${TableName}`,
          'stream'
        >,
      ) => SelectBuilderFor<
        DbType,
        `${SchemaName}.${TableName}`,
        'stream',
        QueryResult
      >,
      cb: (changes: QueryResult[]) => Promise<void>,
      batchSize: number = 5_000,
    ) {
      return tracer.addActiveSpan(
        {
          resource: 'handleSnowflakeTableChanges',
          operation: 'handleSnowflakeTableChanges',
        },
        async () => {
          if (!snowflakeIdentifierRe.test(consumerId)) {
            throw new Error(
              'Invalid consumer id. Consumer ids must contain only A-Z, a-z, 0-9, _ and $.',
            );
          }

          const { table, schema } = toWatch;
          const tableId = sql.table(`${schema}.${table}`);
          const streamNameId = sql.id(
            schema,
            `${table}_CONSUMER_${consumerId}_STREAM`,
          );

          const streamReference = streamNameId.as(
            'stream',
          ) as AliasedRawBuilder<
            Selectable<DbType[`${SchemaName}.${TableName}`]>,
            'stream'
          >;

          // If this is the first time seeing this consumer, we need to create the stream.
          await sql<void>`
            CREATE STREAM IF NOT EXISTS
            ${streamNameId} ON TABLE ${tableId};`.execute(snowflake);

          await snowflake
            .transaction()
            .setIsolationLevel('repeatable read')
            .execute(async (trx) => {
              let changes,
                offset = 0;
              while (changes === undefined || changes.length === batchSize) {
                // some limit of kysely's types/TS' reasoning ability requires the cast below.
                changes = await buildQuery(
                  trx.selectFrom(streamReference) as any,
                )
                  .limit(batchSize)
                  .offset(offset)
                  .execute();

                offset += batchSize;

                // call the callback. Let it throw or resolve to decide whether the
                // transaction will continue + ultimately be committed.
                await cb(changes);
              }

              // To advance the stream's offset (now that the callback returned
              // successfully), Snowflake requires us to perform some DML operation that
              // references the stream (even if it's a no-op on the stream). So, that's
              // what we do below. This is strange, but explicitly documented, behavior.
              // The table we pick for the fake insert (here, ALL_ORGS) is really arbitrary.
              // NB: this is intentionally not type safe, since it's assuming that we're in
              // our global Snowflake db, w/ access to public schema tables, even if the
              // services (w/ their own schemas) don't know about those public tables.
              await (trx as unknown as Transaction<SnowflakePublicSchema>)
                .insertInto(`PUBLIC.ALL_ORGS`)
                .columns(['ID'])
                .expression((builder) =>
                  builder
                    .selectFrom(streamReference)
                    .select(sql.lit('ignored').as('dummy'))
                    .where(sql.raw('1 = 0')),
                )
                .execute();
            });
        },
      );
    },
);

export type handleSnowflakeTableChanges = ReturnType<
  typeof makeHandleSnowflakeTableChanges
>;
