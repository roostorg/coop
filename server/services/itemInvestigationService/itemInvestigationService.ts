/* eslint-disable max-lines */
import type { ItemIdentifier } from '@roostorg/types';
import _ from 'lodash';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  isRealItemIdentifier,
  itemIdentifierToScyllaItemIdentifier,
  ScyllaNilItemIdentifier,
  type Scylla,
  type ScyllaItemIdentifier,
} from '../../scylla/index.js';
import type { ContentApiRequestLogEntry } from '../analyticsLoggers/ContentApiLogger.js';
import { type RuleExecutionCorrelationId } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { filterNullOrUndefined } from '../../utils/collections.js';
import {
  fromCorrelationId,
  type CorrelationId,
} from '../../utils/correlationIds.js';
import { jsonStringify, type JsonOf } from '../../utils/encoding.js';
import {
  chunkAsyncIterableByKey,
  mapAsyncIterable,
} from '../../utils/iterables.js';
import { DAY_MS, MONTH_MS } from '../../utils/time.js';
import { tryParseNonEmptyString } from '../../utils/typescript-types.js';
import {
  getFieldValueForRole,
  itemSubmissionToItemSubmissionWithTypeIdentifier,
  type ItemSubmissionWithTypeIdentifier,
  type NormalizedItemData,
} from '../itemProcessingService/index.js';
import { type ReportingRuleExecutionCorrelationId } from '../reportingService/index.js';
import {
  type ScyllaItemSubmissionsRow,
  type ScyllaRelations,
} from './dbTypes.js';
import {
  RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB,
  type ReturnUnlimitedResultsAndPotentiallyHangDb,
} from './itemInvestigationServiceAdapter.js';
import {
  dbRowToItemSubmissionWithItemTypeIdentifier,
  getEmptyAsyncIterable,
  getSyntheticThreadId,
  partitionLatestAndPriorSubmissions,
} from './utils.js';
import { type IActionExecutionsAdapter } from '../../plugins/warehouse/queries/IActionExecutionsAdapter.js';
import {
  type ContentApiRequestRecord,
  type IContentApiRequestsAdapter,
} from '../../plugins/warehouse/queries/IContentApiRequestsAdapter.js';
import { type SubmissionId } from '../itemProcessingService/makeItemSubmission.js';

/**
 * The ItemInvestigationService API exposes `limit` parameters
 * in almost all of its data retrieval methods, which refers to the number of
 * unique items the consumer would like to receive. Because the underlying data
 * stores hold item submissions, of which there can be multiple per item,
 * the service often needs to retrieve more than `limit` number of rows from the
 * data stores and reduce them down to a set of unique item before returning to
 * the consumer, and often necessitates issuing multiple queries.
 * This ARTIFICIAL_LIMIT_MULTIPLIER is used to minimize the amount
 * of queries the service dispatches to the databases by inflating the `limit`
 * we provide in queries by our observed ratio of
 * ((Item Submissions) / (Unique Item Identifiers))
 */
const ARTIFICIAL_LIMIT_MULTIPLIER = 1;

/**
 * For all methods exposed by this class, the consumers are likely calling
 * "Items" in mind, meaning submissions with unique ItemIdentifiers. the
 * datastores that support this service deal with Item Submissions, which are
 * many-to-one with Items. i.e. one item can be submitted multiple times. This
 * service's API accounts for this by providing a distinction between the latest
 * submission of an item, and all the prior submissions, and in all streams
 * emits an object with those two properties to represent that, i.e.
 * {
 *   latestSubmission: ItemSubmissionWithTypeIdentifier,
 *   priorSubmissions?: ItemSubmissionWithTypeIdentifier[],
 * }
 *
 * The Service makes a best effort to de-duplicate submissions and represent
 * them in the above format. However, due to the implementation there is still a
 * possibility that a submission will be represented twice in the output stream.
 * This occurs when the service has to make multiple queries to the datastores
 * to fulfill a request, and the full set of submissions that make up an item's
 * submission history ends up split across the query-boundary.
 *
 * The first explanation of this was left in a github comment:
 * https://github.com/roostorg/coop/pull/1605#issuecomment-1721584595
 *
 * and there is a JIRA task for the fix:
 * https://coop.atlassian.net/browse/COOP-1291
 *
 */
export type SubmissionsForItemWithTypeIdentifier = {
  latestSubmission: ItemSubmissionWithTypeIdentifier;
  priorSubmissions?: ItemSubmissionWithTypeIdentifier[];
};

export class ItemInvestigationService {
  private readonly scylla: Scylla<ScyllaRelations>;
  private readonly selectStream: Scylla<ScyllaRelations>['selectStream'];
  private readonly select: Scylla<ScyllaRelations>['select'];
  private readonly insert: Scylla<ScyllaRelations>['insert'];
  constructor(
    scylla: Scylla<ScyllaRelations>,
    tracer: Dependencies['Tracer'],
    private readonly partialItemsEndpoint: Dependencies['PartialItemsService'],
    private readonly actionExecutionsAdapter: IActionExecutionsAdapter,
    private readonly contentApiRequestsAdapter: IContentApiRequestsAdapter,
    private readonly meter: Dependencies['Meter'],
  ) {
    this.scylla = scylla;

    this.selectStream = tracer.traced(
      {
        resource: 'scylla.client',
        operation: 'scylla.selectStream',
        attributesFromArgs(args) {
          const { from, select, where, ...rest } = args[0];
          return {
            'query.from': from,
            'query.select': jsonStringify(select),
            'query.where': jsonStringify(where),
            'query.otherOpts': jsonStringify(rest),
          };
        },
      },
      this.scylla.selectStream.bind(this.scylla),
    );
    this.select = tracer.traced(
      {
        resource: 'scylla.client',
        operation: 'scylla.select',
        attributesFromArgs(args) {
          const { from, select, where, ...rest } = args[0];
          return {
            'query.from': from,
            'query.select': jsonStringify(select),
            'query.where': jsonStringify(where),
            'query.otherOpts': jsonStringify(rest),
          };
        },
      },
      this.scylla.select.bind(this.scylla),
    );
    this.insert = tracer.traced(
      {
        resource: 'scylla.client',
        operation: 'scylla.insert',
        attributesFromArgs(args) {
          const { into } = args[0];
          return {
            'query.into': into,
          };
        },
      },
      this.scylla.insert.bind(this.scylla),
    );
  }

  async insertItem(
    // The failure Reason would always be set to 'null'
    // so we omit it from the argument type.
    data: Omit<
      ContentApiRequestLogEntry<false>,
      'failureReason' | 'requestId'
    > & {
      itemSubmission: { submissionTime: Date };
      requestId: CorrelationId<
        | RuleExecutionCorrelationId
        | ReportingRuleExecutionCorrelationId
        | CorrelationId<'submit-appeal'>
      >;
    },
  ): Promise<void> {
    const item = data.itemSubmission;
    const { itemType } = data.itemSubmission;

    const createdAtFromSchema = getFieldValueForRole(
      itemType.schema,
      itemType.schemaFieldRoles,
      'createdAt',
      item.data,
    );
    const syntheticCreatedAt = createdAtFromSchema
      ? new Date(createdAtFromSchema)
      : item.submissionTime;

    const [threadId, parentId] =
      itemType.kind === 'CONTENT'
        ? [
            getFieldValueForRole(
              itemType.schema,
              itemType.schemaFieldRoles,
              'threadId',
              item.data,
            ),
            getFieldValueForRole(
              itemType.schema,
              itemType.schemaFieldRoles,
              'parentId',
              item.data,
            ),
          ]
        : [];

    const itemIdentifier = { id: item.itemId, typeId: itemType.id };
    const syntheticThreadId = getSyntheticThreadId(itemIdentifier, threadId);

    await this.insert({
      into: 'item_submission_by_thread',
      row: {
        org_id: data.orgId,
        request_id: fromCorrelationId(data.requestId),
        submission_id: item.submissionId,
        item_identifier: itemIdentifierToScyllaItemIdentifier(itemIdentifier),
        item_type_name: itemType.name,
        item_type_version: itemType.version,
        item_creator_identifier: item.creator
          ? itemIdentifierToScyllaItemIdentifier(item.creator)
          : ScyllaNilItemIdentifier,
        item_data: jsonStringify(item.data),
        //TODO: create datestamp in submitItems route and use
        // for write to both scylla and snowflake
        item_submission_time: new Date(),
        item_synthetic_created_at: syntheticCreatedAt,
        synthetic_thread_id: syntheticThreadId,
        thread_identifier: threadId
          ? itemIdentifierToScyllaItemIdentifier(threadId)
          : ScyllaNilItemIdentifier,
        parent_identifier: parentId
          ? itemIdentifierToScyllaItemIdentifier(parentId)
          : ScyllaNilItemIdentifier,
        item_type_schema_field_roles: jsonStringify(itemType.schemaFieldRoles),
        item_type_schema: jsonStringify(itemType.schema),
        item_type_schema_variant: itemType.schemaVariant,
      },
    });

    //TODO: if parent_id, read parent by id and update ttl
  }

  /**
   * the returned object's fields (when all streams are closed)
   * will have the following order:
   *
   * {
   *   parents: from child back to root
   *   subsequentItems: chronological order
   *   priorItems: chronological order
   * }
   */
  getThreadSubmissionsByPosition(opts: {
    orgId: string;
    threadId: ItemIdentifier;
    parentId: ItemIdentifier | null;
    siblingsSplitAtDate: Date;
    numPriorSiblings?: number;
    numSubsequentSiblings?: number;
    numParentLevels?: number;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): {
    parents: AsyncIterable<SubmissionsForItemWithTypeIdentifier>;
    priorSiblings: AsyncIterable<SubmissionsForItemWithTypeIdentifier>;
    subsequentSiblings: AsyncIterable<SubmissionsForItemWithTypeIdentifier>;
  } {
    const {
      orgId,
      threadId,
      parentId,
      numPriorSiblings = 5,
      numSubsequentSiblings = 0,
      numParentLevels = 3,
      siblingsSplitAtDate,
      latestSubmissionsOnly = true,
      oldestReturnedSubmissionDate = new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 7,
      ),
    } = opts;

    const syntheticThreadId = getSyntheticThreadId(threadId);
    const parentIdentifier = parentId
      ? itemIdentifierToScyllaItemIdentifier(parentId)
      : ScyllaNilItemIdentifier;

    return {
      parents: mapAsyncIterable(
        this.#getParentStream({
          orgId,
          syntheticThreadId,
          parentIdentifier,
          numParentLevels,
          oldestReturnedSubmissionDate,
          latestSubmissionsOnly,
        }),
        scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier,
      ),
      subsequentSiblings: mapAsyncIterable(
        this.#getSiblingStream({
          orgId,
          syntheticThreadId,
          parentIdentifier,
          referenceTime: siblingsSplitAtDate,
          itemLimit: numSubsequentSiblings,
          siblingAge: 'younger',
          latestSubmissionsOnly,
        }),
        scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier,
      ),
      priorSiblings: mapAsyncIterable(
        this.#getSiblingStream({
          orgId,
          syntheticThreadId,
          parentIdentifier,
          referenceTime: siblingsSplitAtDate,
          itemLimit: numPriorSiblings,
          siblingAge: 'older',
        }),
        scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier,
      ),
    };
  }

  /**
   * Retrieves n messages going backwards from a given time and optionally
   * returns the ancestors of each retrieved item Useful for retrieving the last
   * n messages in a conversation-like thread.
   *
   * The output contains items ordered reverse chronologically (most recent to
   * oldest), each one bundled with an iterable of its parents, ordered from the
   * leaf back to the root ancestor.
   */
  async *getThreadSubmissionsByTime(opts: {
    orgId: string;
    threadId: ItemIdentifier;
    limit?: number;
    numParentLevels?: number;
    newestReturnedSubmissionDate?: Date;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<{
    latestSubmission: ItemSubmissionWithTypeIdentifier;
    priorSubmissions?: ItemSubmissionWithTypeIdentifier[];
    parents: AsyncIterable<SubmissionsForItemWithTypeIdentifier>;
  }> {
    const {
      orgId,
      threadId,
      limit = 10,
      numParentLevels = 1,
      oldestReturnedSubmissionDate = new Date(Date.now() - MONTH_MS * 3),
      newestReturnedSubmissionDate = new Date(),
      latestSubmissionsOnly = true,
    } = opts;

    const syntheticThreadId = getSyntheticThreadId(threadId);
    /**
     * The `emptyQueryResult` variable lets us distinguish between the two
     * cases which cause the loop to yield no results:
     * 1. The datastore returned items which were for some reason filtered
     *    out, leaving fewer items to return than the `limit` option
     *    specified. In this case we want to perform another query looking
     *    further back in time to find submissions that can be returned
     *    to the client.
     * 2. The datastore did not have any results at all, in which case
     *     subsequent queries will also not produce any results and the
     *     search should halt
     */
    let emptyQueryResult = true;
    let returnedItemCount = 0;
    // Add a millisecond so that the startingi date is inclusive in the "<"
    // query
    let startingDate = new Date(newestReturnedSubmissionDate.getTime() + 1);
    const now = Date.now();

    while (
      returnedItemCount < limit &&
      startingDate > oldestReturnedSubmissionDate
    ) {
      const threadSubmissions = this.selectStream({
        from: 'item_submission_by_thread_and_time',
        select: '*',
        where: [
          ['org_id', '=', orgId],
          ['synthetic_thread_id', '=', syntheticThreadId],
          // we don't want tor return the item that triggered the search,
          // so the query shohuld not be inclusive of the startingDate
          // using `<` instead of `<=` also prevents searching infinitely
          // for a date which only returns a threadItem, which gets filtered out
          // of the result set
          ['item_synthetic_created_at', '<', startingDate],
          ['item_synthetic_created_at', '>=', oldestReturnedSubmissionDate],
        ],
        limit: Math.floor(
          (limit - returnedItemCount) * ARTIFICIAL_LIMIT_MULTIPLIER,
        ),
        // the materialized view is ordered this way,
        // but this makes the query more explicit
        sortOrder: [['item_synthetic_created_at', 'DESC']],
      });

      const submissionGroups = chunkAsyncIterableByKey(
        threadSubmissions,
        (it: ScyllaItemSubmissionsRow) => jsonStringify(it.item_identifier),
      );

      const scyllaThreadId = itemIdentifierToScyllaItemIdentifier(threadId);
      for await (const submissionsForItem of submissionGroups) {
        const { latestSubmission, priorSubmissions } =
          partitionLatestAndPriorSubmissions(submissionsForItem);

        // Counting old records to find out how often we would be missing data
        // if we reduced the Scylla TTL to 14 days
        const difference = Math.abs(
          now - latestSubmission.item_submission_time.getTime(),
        );
        const daysOld = Math.floor(difference / DAY_MS);
        this.meter.scyllaRecordAgeHistogram.record(daysOld);

        // if the item identifier is identical to the thread identifier, then
        // the thread item itself is present in the scylla partition for this thread
        // but we don't want to return it to the client since it is not a logically
        // valid item within the thread (itself).
        // So if we find an identical item_id/thread_id pair we don't yield anything
        // to the stream and move on with the search
        if (!_.isEqual(latestSubmission.item_identifier, scyllaThreadId)) {
          const parents = isRealItemIdentifier(
            latestSubmission.parent_identifier,
          )
            ? mapAsyncIterable(
                this.#getParentStream({
                  orgId,
                  syntheticThreadId,
                  parentIdentifier: latestSubmission.parent_identifier,
                  numParentLevels,
                  oldestReturnedSubmissionDate,
                  latestSubmissionsOnly,
                }),
                scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier,
              )
            : getEmptyAsyncIterable<SubmissionsForItemWithTypeIdentifier>();

          yield {
            ...scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier({
              latestSubmission,
              priorSubmissions: latestSubmissionsOnly
                ? undefined
                : priorSubmissions,
            }),
            parents,
          };

          // manually track how many distinct items have been returned
          returnedItemCount++;
        }
        emptyQueryResult = false;
        if (returnedItemCount >= limit) {
          break;
        }
        // set the new date to work backwards from
        startingDate = latestSubmission.item_synthetic_created_at;
      }
      if (emptyQueryResult) {
        break;
      }
      emptyQueryResult = true;
    }
  }

  /**
   * NB: in this function, getting priorSubmissions is best effort. You aren't
   * guaranteed to get all prior submissions, you may receive some or none of
   * them, even if they exist.
   *
   * NB: Right now, we check the partial items endpoint before checking
   * snowflake. This is likely fine for now, but the partial items endpoint
   * could return an entirely different submission (if the data has been mutated
   * on their side), which could lead to unexpected behavior. It's fine to keep
   * for now but we should keep an eye out for bugs that could stem from this.
   */
  async getItemByIdentifier(opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    latestSubmissionOnly?: boolean;
    signal?: AbortSignal;
  }): Promise<SubmissionsForItemWithTypeIdentifier | null> {
    const { orgId, itemIdentifier, latestSubmissionOnly = true, signal } = opts;

    // Attempt #1: Pull the item from scylla
    // If this fails for any reason, just coerce the error to an empty result
    // (in `.catch()`) so that we'll move on to checking the next fallback source.
    const queryResults = await this.select({
      from: 'item_submission_by_thread',
      select: '*',
      where: [
        [
          'item_identifier',
          '=',
          itemIdentifierToScyllaItemIdentifier(itemIdentifier),
        ],
      ],
    }).catch((_) => []);

    if (queryResults.length) {
      const { latestSubmission, priorSubmissions } =
        partitionLatestAndPriorSubmissions(queryResults);

      return scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier({
        latestSubmission,
        priorSubmissions: latestSubmissionOnly ? undefined : priorSubmissions,
      });
    }

    signal?.throwIfAborted();

    // Attempt #2: Check if there's a partial items endpoint, and if there is,
    // attempt to fetch the item's data from there. Most users won't have a
    // partial items endpoint, so this should only apply in a handful of cases
    // If this fails for any reason, just coerce the error to an empty array so
    // that we'll move on to trying snowflake.
    const partialItemsResult = await this.partialItemsEndpoint
      .getPartialItems(orgId, [itemIdentifier])
      .catch((_e) => []);

    if (partialItemsResult.length > 0) {
      const itemFromPartialItemsEndpoint = partialItemsResult[0];

      return {
        latestSubmission: itemSubmissionToItemSubmissionWithTypeIdentifier(
          itemFromPartialItemsEndpoint,
        ),
        priorSubmissions: latestSubmissionOnly ? undefined : [],
      };
    }

    signal?.throwIfAborted();

    // Attempt #3: Fetch the item from the data warehouse via the content API adapter.
    const records =
      await this.contentApiRequestsAdapter.getSuccessfulRequestsForItem(
        orgId,
        itemIdentifier,
        {
          latestOnly: latestSubmissionOnly,
          lookbackWindowMs: 6 * MONTH_MS,
        },
      );

    if (records.length > 0) {
      const toItemSubmissionWithTypeIdentifier = (
        record: ContentApiRequestRecord,
      ) => {
        const submissionId = record.submissionId as SubmissionId;
        const itemData = record.itemData as JsonOf<NormalizedItemData>;
        const schemaVariant = record.itemTypeSchemaVariant as
          | 'original'
          | 'partial';

        return dbRowToItemSubmissionWithItemTypeIdentifier({
          submission_id: submissionId,
          item_identifier: {
            id: tryParseNonEmptyString(itemIdentifier.id),
            type_id: tryParseNonEmptyString(itemIdentifier.typeId),
          },
          item_type_version: record.itemTypeVersion,
          item_creator_identifier:
            record.itemCreatorId && record.itemCreatorTypeId
              ? {
                  id: tryParseNonEmptyString(record.itemCreatorId),
                  type_id: tryParseNonEmptyString(record.itemCreatorTypeId),
                }
              : ({ id: '', type_id: '' } as const),
          item_data: itemData,
          item_submission_time: record.occurredAt,
          item_type_schema_variant: schemaVariant,
        });
      };

      const [latestRecord, ...priorRecords] = records;

      return {
        latestSubmission: toItemSubmissionWithTypeIdentifier(latestRecord),
        priorSubmissions: latestSubmissionOnly
          ? undefined
          : priorRecords.map(toItemSubmissionWithTypeIdentifier),
      };
    }

    return null;
  }

  getAncestorItems(opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    numParentLevels: number;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<SubmissionsForItemWithTypeIdentifier> {
    return mapAsyncIterable(
      this.getAncestorItemStream(opts),
      scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier,
    );
  }

  /**
   * This differs from the `getParentStream` method in that it doesn't ensure
   * items are part of the same thread, to support parent-child relationships
   * that don't have a connecting thread ID.
   * This method returns an async iterable of a given item's ancestors, i.e.
   * its parent, that posts parent, etc
   */
  async *getAncestorItemStream(opts: {
    orgId: string;
    itemIdentifier: ItemIdentifier;
    numParentLevels: number;
    oldestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<{
    latestSubmission: ScyllaItemSubmissionsRow;
    priorSubmissions?: ScyllaItemSubmissionsRow[];
  }> {
    const {
      orgId,
      numParentLevels,
      oldestReturnedSubmissionDate = new Date(
        Date.now() - 1000 * 60 * 60 * 24 * 7,
      ),
      latestSubmissionsOnly = true,
      itemIdentifier,
    } = opts;
    // This is the given item, so we should not yield the first item found in
    // the results
    let currentParent: ScyllaItemIdentifier =
      itemIdentifierToScyllaItemIdentifier(itemIdentifier);

    for (
      let i = 0;
      i < numParentLevels + 1 && isRealItemIdentifier(currentParent);
      i++
    ) {
      const potentialParents = await this.select({
        select: '*',
        from: 'item_submission_by_thread',
        where: [
          // using the GSI on item_identifier, we can't also constrain by
          // synthetic_created_at or org_id :(
          ['item_identifier', '=', currentParent],
        ],
      });

      // This first filters out any parents that are somehow part of a different
      // org. Then splits the submissions between
      // the most recent submission of that item and all its prior submissions
      // because the GSI we are using disallows constraining the
      // synthetic_created_at column, we also use this filter to filter out
      // submissions older than the oldestReturnedSubmissionDate
      const parentSubmissions = potentialParents.filter(
        (row) =>
          row.item_synthetic_created_at >= oldestReturnedSubmissionDate &&
          row.org_id === orgId,
      );

      const { latestSubmission, priorSubmissions } =
        partitionLatestAndPriorSubmissions(parentSubmissions);

      // the no-unnecessary condition check assumes that all array accesses are
      // valid since the type of the array does not include `| undefined` but
      // out of bounds accesses in js allow this behavior. So while TS thinks
      // the parentItemRow will always be of type `ScyllaItemSubmissionsRow` (or similar), it
      // is possible that it doesn't exist and we want to prevent the generator
      // from yielding `undefined`
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (latestSubmission) {
        currentParent = latestSubmission.parent_identifier;
        if (i === 0) {
          // to avoid yielding the given item as its own parent, don't yield on
          // the first iteration
          continue;
        }
        yield {
          latestSubmission,
          priorSubmissions: latestSubmissionsOnly
            ? undefined
            : priorSubmissions,
        };
      } else {
        break;
      }
    }
  }

  async *#getParentStream(opts: {
    orgId: string;
    parentIdentifier: ScyllaItemIdentifier;
    syntheticThreadId: string;
    numParentLevels: number;
    oldestReturnedSubmissionDate: Date;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<{
    latestSubmission: ScyllaItemSubmissionsRow;
    priorSubmissions?: ScyllaItemSubmissionsRow[];
  }> {
    const {
      orgId,
      parentIdentifier,
      syntheticThreadId,
      numParentLevels,
      oldestReturnedSubmissionDate,
      latestSubmissionsOnly = true,
    } = opts;
    let currentParent = parentIdentifier;

    for (
      let i = 0;
      i < numParentLevels && isRealItemIdentifier(currentParent);
      i++
    ) {
      const potentialParents = await this.select({
        select: '*',
        from: 'item_submission_by_thread',
        where: [
          // using the GSI on item_identifier, we can't also constrain by
          // synthetic_created_at or org_id :(
          ['item_identifier', '=', currentParent],
        ],
      });

      // This first filters out any parents that are somehow part of a different
      // thread, or from a different org. Then splits the submissions between
      // the most recent submission of that item and all its prior submissions
      // because the GSI we are using disallows constraining the
      // synthetic_created_at column, we also use this filter to filter out
      // submissions older than the oldestReturnedSubmissionDate
      //
      // TODO: Peter/Nick , we should consider item type relationships
      // where there is a parent-child relationship but no connecting
      // thread ID, maybe that can be handled with a different query
      // specifically for ancestors of a given item
      const parentSubmissions = potentialParents.filter(
        (row) =>
          row.item_synthetic_created_at >= oldestReturnedSubmissionDate &&
          row.synthetic_thread_id === syntheticThreadId &&
          row.org_id === orgId,
      );

      const { latestSubmission, priorSubmissions } =
        partitionLatestAndPriorSubmissions(parentSubmissions);

      // the no-unnecessary condition check assumes that all array accesses are
      // valid since the type of the array does not include `| undefined` but
      // out of bounds accesses in js allow this behavior. So while TS thinks
      // the parentItemRow will always be of type `ScyllaItemSubmissionsRow` (or similar), it
      // is possible that it doesn't exist and we want to prevent the generator
      // from yielding `undefined`
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (latestSubmission) {
        yield {
          latestSubmission,
          priorSubmissions: latestSubmissionsOnly
            ? undefined
            : priorSubmissions,
        };
        currentParent = latestSubmission.parent_identifier;
      } else {
        break;
      }
    }
    //TODO: Fallback to Snowflake for parents not found
    // in initial snowflake query
  }

  async *#getSiblingStream(opts: {
    orgId: string;
    syntheticThreadId: string;
    parentIdentifier: ScyllaItemIdentifier;
    referenceTime: Date;
    siblingAge: 'older' | 'younger';
    itemLimit: number;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<{
    latestSubmission: ScyllaItemSubmissionsRow;
    priorSubmissions?: ScyllaItemSubmissionsRow[];
  }> {
    const {
      orgId,
      syntheticThreadId,
      parentIdentifier,
      referenceTime,
      itemLimit,
      siblingAge,
      latestSubmissionsOnly = true,
    } = opts;

    if (itemLimit <= 0) {
      return getEmptyAsyncIterable();
    }

    let returnedItemCount = 0;
    let emptyQueryResult = true;
    let searchStartDate = siblingAge === 'older' ? referenceTime : new Date();
    while (returnedItemCount < itemLimit) {
      const stream = this.selectStream({
        select: '*',
        from: 'item_submission_by_thread',
        where: [
          ['org_id', '=', orgId],
          ['synthetic_thread_id', '=', syntheticThreadId],
          ['parent_identifier', '=', parentIdentifier],
          [
            'item_synthetic_created_at',
            siblingAge === 'older' ? '<' : '>',
            referenceTime,
          ],
          // Time must be compared to the option provided, referenceTime,
          // and the internal searchStartDate
          ['item_synthetic_created_at', '<', searchStartDate],
        ],
        limit: Math.floor(itemLimit * ARTIFICIAL_LIMIT_MULTIPLIER),
      });

      const submissionGroups = chunkAsyncIterableByKey(stream, (it) =>
        jsonStringify(it.item_identifier),
      );

      for await (const submissionsForItem of submissionGroups) {
        const { latestSubmission, priorSubmissions } =
          partitionLatestAndPriorSubmissions(submissionsForItem);

        yield {
          latestSubmission,
          priorSubmissions: latestSubmissionsOnly
            ? undefined
            : priorSubmissions,
        };

        returnedItemCount++;
        emptyQueryResult = false;
        if (returnedItemCount >= itemLimit) {
          break;
        }
        searchStartDate = latestSubmission.item_synthetic_created_at;
      }
      if (emptyQueryResult) {
        break;
      }
      emptyQueryResult = true;
    }
  }

  /**
   * Items are returned in reverse chronological order starting at the
   * present moment and going back in time until the limit is reached,
   * the oldestReturnedSubmissionDate is passed, or no more items are
   * found in any of the available datastores
   */
  async *getItemSubmissionsByCreator(opts: {
    orgId: string;
    itemCreatorIdentifier: ItemIdentifier;
    limit?: number | ReturnUnlimitedResultsAndPotentiallyHangDb;
    oldestReturnedSubmissionDate?: Date;
    earliestReturnedSubmissionDate?: Date;
    latestSubmissionsOnly?: boolean;
  }): AsyncIterable<SubmissionsForItemWithTypeIdentifier> {
    const {
      orgId,
      itemCreatorIdentifier,
      limit = 100,
      oldestReturnedSubmissionDate = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ),
      earliestReturnedSubmissionDate = new Date(),
      latestSubmissionsOnly = true,
    } = opts;

    let returnedItemCount = 0;
    let emptyQueryResult = true;
    let searchStartDate = earliestReturnedSubmissionDate;
    const now = Date.now();
    while (
      limit === RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB ||
      returnedItemCount < limit
    ) {
      const stream = this.selectStream({
        from: 'item_submission_by_creator',
        select: '*',
        where: [
          ['org_id', '=', orgId],
          [
            'item_creator_identifier',
            '=',
            itemIdentifierToScyllaItemIdentifier(itemCreatorIdentifier),
          ],
          ['item_synthetic_created_at', '<', searchStartDate],
          ['item_synthetic_created_at', '>', oldestReturnedSubmissionDate],
        ],
        limit:
          limit === RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB
            ? undefined
            : Math.floor(
                (limit - returnedItemCount) * ARTIFICIAL_LIMIT_MULTIPLIER,
              ),
        sortOrder: [['item_synthetic_created_at', 'DESC']],
      });

      const groupedStream = chunkAsyncIterableByKey(
        stream,
        (it: ScyllaItemSubmissionsRow) => jsonStringify(it.item_identifier),
      );

      for await (const itemGroup of groupedStream) {
        const { latestSubmission, priorSubmissions } =
          partitionLatestAndPriorSubmissions(itemGroup);
        // Counting old records to find out how often we would be missing data
        // if we reduced the Scylla TTL to 14 days
        const difference = Math.abs(
          now - latestSubmission.item_submission_time.getTime(),
        );
        const daysOld = Math.floor(difference / DAY_MS);
        this.meter.scyllaRecordAgeHistogram.record(daysOld);
        yield {
          latestSubmission:
            dbRowToItemSubmissionWithItemTypeIdentifier(latestSubmission),
          priorSubmissions: latestSubmissionsOnly
            ? undefined
            : priorSubmissions.map(dbRowToItemSubmissionWithItemTypeIdentifier),
        };
        // manually track how many distinct items have been returned
        returnedItemCount++;
        emptyQueryResult = false;
        if (
          limit !== RETURN_UNLIMITED_RESULTS_AND_POTENTIALLY_HANG_DB &&
          returnedItemCount >= limit
        ) {
          break;
        }
        searchStartDate = latestSubmission.item_synthetic_created_at;
      }
      if (emptyQueryResult) {
        break;
      }
      emptyQueryResult = true;
    }
  }

  async #updateItemSubmissionTTL(_opts: {
    org_id: string;
    itemID: ItemIdentifier;
    submissionID: string;
  }) {
    // find by ID
    // INSERT all rows WITH TTL 30 days
    throw new Error('Not Implemented');
  }

  async getItemActionHistory(opts: {
    orgId: string;
    itemId: string;
    itemTypeId: string;
    itemSubmissionTime: Date | undefined;
  }) {
    const { itemId, itemTypeId, orgId, itemSubmissionTime } = opts;

    const records = await this.actionExecutionsAdapter.getItemActionHistory({
      orgId,
      itemId,
      itemTypeId,
      itemSubmissionTime,
    });

    return filterNullOrUndefined(
      records.map((record) => {
        if (!record.itemId || !record.itemTypeId) {
          return undefined;
        }

        return {
          actionId: record.actionId,
          itemId: record.itemId,
          itemTypeId: record.itemTypeId,
          actorId: record.actorId ?? undefined,
          jobId: record.jobId ?? undefined,
          itemCreatorId: record.userId ?? undefined,
          itemCreatorTypeId: record.userTypeId ?? undefined,
          policies: record.policies,
          ruleIds: record.ruleIds,
          ts: record.occurredAt,
        };
      }),
    );
  }
}

function scyllaSubmissionsForItemToSubmissionsForItemWithTypeIdentifier(it: {
  latestSubmission: ScyllaItemSubmissionsRow;
  priorSubmissions?: ScyllaItemSubmissionsRow[];
}) {
  return {
    latestSubmission: dbRowToItemSubmissionWithItemTypeIdentifier(
      it.latestSubmission,
    ),
    priorSubmissions: it.priorSubmissions?.map(
      dbRowToItemSubmissionWithItemTypeIdentifier,
    ),
  };
}
