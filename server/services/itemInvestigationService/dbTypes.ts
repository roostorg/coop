import type {
  ScyllaItemIdentifier,
  ScyllaRealItemIdentifier,
} from '../../scylla/index.js';
import { type JsonOf } from '../../utils/encoding.js';
import {
  type NormalizedItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import {
  type ItemSchema,
  type SchemaFieldRoles,
} from '../moderationConfigService/index.js';

/**
 * This type matches the definition of the item_submissions_by_thread table in
 * ScyllaDB. Data going into or out of the item_investigation_service namescpace
 * in Scylla should have this shape.
 *
 * The `synthetic_thread_id` field is a generated value which is used to ensure
 * that all items submitted to the itemsInvestigationService are organizable by
 * some "thread". In the case that an Item has associated thread information,
 * the synthetic thread id just encodes the thread's item id and item type id.
 * In the case that there is no thread associated with a submitted item, the
 * synthetic_thread_id is generated from the items typeIdentifier information.
 * This allows the item to be stored and organized in the initial
 * item_submissions_by_thread table as well as any and all materialized views
 * generated from that table, even if it does not have a thread of its own. The
 * record of that item in the primary `item_submissions_by_thread` table is
 * essentially useless, but its presence in materialized views allows it to be
 * accessed in queries by creator, by time, and by item identifier.
 *
 * On item submission, we record both the item's creation time in the user's
 * system via the Schema Field Roles, as we all it's submission time to Coop.
 * In the event of an edited item, it will likely be re-submitted to Coop but
 * it's creation time should not change. In this case, we will have multiple
 * item submissions with the same item identifier and same creation time, so
 * the submission time field can be used to distinguish which copy of it is the
 * most up-to-date.
 */
export type ScyllaItemSubmissionsRow = {
  org_id: string;
  request_id: string | null;
  submission_id: SubmissionId;
  item_identifier: ScyllaRealItemIdentifier;
  item_type_name: string | null;
  item_type_version: string;
  item_creator_identifier: ScyllaItemIdentifier;
  item_data: JsonOf<NormalizedItemData>;
  item_submission_time: Date;
  item_synthetic_created_at: Date;
  synthetic_thread_id: string;
  parent_identifier: ScyllaItemIdentifier;
  thread_identifier: ScyllaItemIdentifier;
  item_type_schema_field_roles: JsonOf<SchemaFieldRoles>;
  item_type_schema: JsonOf<ItemSchema>;
  item_type_schema_variant: 'original' | 'partial';
};

export type ScyllaTables = {
  item_submission_by_thread: ScyllaItemSubmissionsRow;
};

export type ScyllaViews = {
  item_submission_by_item_id: ScyllaItemSubmissionsRow;
  item_submission_by_thread_and_time: ScyllaItemSubmissionsRow;
  item_submission_by_creator: ScyllaItemSubmissionsRow;
};

export type ScyllaRelations = ScyllaTables & ScyllaViews;
