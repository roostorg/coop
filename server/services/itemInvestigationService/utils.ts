import type { ItemIdentifier } from '@roostorg/types';
import _ from 'lodash';
import stringify from 'safe-stable-stringify';
import _S2A from 'stream-to-async-iterator';

import {
  isRealItemIdentifier,
  scyllaItemIdentifierToItemIdentifier,
  type ScyllaItemIdentifier,
  type ScyllaRealItemIdentifier,
} from '../../scylla/index.js';
import { jsonParse, jsonStringify, type JsonOf } from '../../utils/encoding.js';
import {
  instantiateOpaqueType,
  type NonEmptyArray,
} from '../../utils/typescript-types.js';
import { type SubmissionId } from '../itemProcessingService/makeItemSubmission.js';
import { type ItemSubmissionWithTypeIdentifier } from '../itemProcessingService/makeItemSubmissionWithTypeIdentifier.js';
import { type NormalizedItemData } from '../itemProcessingService/toNormalizedItemDataOrErrors.js';
import { type ScyllaItemSubmissionsRow } from './dbTypes.js';

/**
 * Returns a string used to logically partition related item submissions
 * together in the underlying data store.
 */
export function getSyntheticThreadId(
  itemIdentifier: ItemIdentifier,
  threadIdentifier?: ItemIdentifier,
) {
  const availableIdentifier = threadIdentifier ?? itemIdentifier;
  return jsonStringify([availableIdentifier.typeId, availableIdentifier.id]);
}

/**
 * TODO: Eventually this should handle rows from both snowflake and scylla more
 * naturally, but right now we're required to convert the snowflake shape into a
 * scylla-specific shape
 */
export function dbRowToItemSubmissionWithItemTypeIdentifier(row: {
  submission_id: SubmissionId;
  item_identifier: ScyllaRealItemIdentifier;
  item_type_version: string;
  item_creator_identifier: ScyllaItemIdentifier;
  item_data: JsonOf<NormalizedItemData>;
  item_submission_time?: Date;
  item_type_schema_variant: 'original' | 'partial';
}) {
  return instantiateOpaqueType<ItemSubmissionWithTypeIdentifier>({
    creator: isRealItemIdentifier(row.item_creator_identifier)
      ? scyllaItemIdentifierToItemIdentifier(row.item_creator_identifier)
      : undefined,
    submissionId: row.submission_id,
    submissionTime: row.item_submission_time,
    itemId: row.item_identifier.id,
    data: jsonParse(row.item_data),
    itemTypeIdentifier: {
      id: row.item_identifier.type_id,
      version: row.item_type_version,
      schemaVariant: row.item_type_schema_variant,
    },
  });
}

export function getLatestSubmission(
  submissions: NonEmptyArray<ScyllaItemSubmissionsRow>,
): ScyllaItemSubmissionsRow;
export function getLatestSubmission(
  submissions: ScyllaItemSubmissionsRow[],
): ScyllaItemSubmissionsRow | undefined;
export function getLatestSubmission(submissions: ScyllaItemSubmissionsRow[]) {
  return _.maxBy(submissions, (i) => i.item_submission_time.getTime());
}

/**
 * This function take an array of Scylla Rows representing multiple
 * submissions of the same Item and returns an object that splits those
 * submissions by the most recent, and all the previous submissions
 *
 * This function does not validate that all the input submissions do in
 * fact have the same ItemIdentifier, so the caller must ensure that this
 * is the case for the input array.
 *
 */
export function partitionLatestAndPriorSubmissions(
  submissions: ScyllaItemSubmissionsRow[],
): {
  latestSubmission: ScyllaItemSubmissionsRow;
  priorSubmissions: ScyllaItemSubmissionsRow[];
} {
  const sortedItemSubmissions = _.sortBy(
    submissions,
    // sort by negative time to have array sorted from latest
    // time (largest integer value), to oldest
    (i) => -i.item_submission_time.getTime(),
  );
  const [latestSubmission, ...priorSubmissions] = sortedItemSubmissions;
  return {
    latestSubmission,
    //Dedupe submissions that were submitted with identical data
    priorSubmissions: removeDuplicateSubmissionsByData(priorSubmissions),
  };
}

export function removeDuplicateSubmissionsByData(
  submissions: ScyllaItemSubmissionsRow[],
) {
  return _.uniqBy(submissions, (x: ScyllaItemSubmissionsRow) =>
    stringify(x.item_data),
  );
}

export function getEmptyAsyncIterable<T>(): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined as T };
        },
      };
    },
  };
}
