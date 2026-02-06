import { type ItemIdentifier } from '@roostorg/types';
import { type Opaque, type ReadonlyDeep, type UnwrapOpaque } from 'type-fest';
import { v4 as uuidv4 } from 'uuid';

import { ErrorType, makeBadRequestError } from '../../utils/errors.js';
import { assertUnreachable } from '../../utils/misc.js';
import { instantiateOpaqueType } from '../../utils/typescript-types.js';
import {
  type ItemType,
  type ItemTypeSchemaVariant,
  type ItemTypeSelector,
} from '../moderationConfigService/index.js';
import { type GetItemTypeEventuallyConsistent } from '../moderationConfigService/moderationConfigServiceQueries.js';
import { getFieldValueForRole } from './extractItemDataValues.js';
import {
  toNormalizedItemDataOrErrors,
  type NormalizedItemData,
  type RawItemData,
} from './toNormalizedItemDataOrErrors.js';
import { type RawItemSubmission } from './types.js';

/**
 * An "item" represents a logical _entity_ on the user's platform. In this
 * context, an entity specifically refers to something with a fixed identity but
 * mutable state. For example, a user would be an item, as it's still "the same"
 * user, even if they change their username or profile picture.
 *
 * Because an item's state can change over time -- e.g., a post's content can
 * get edited; a user can change their profile pic; etc -- we also have a
 * concept representing "an item with its current data as sent to Coop at some
 * point in time". That's what an "item submission" is, conceptually.
 *
 * However, when an item with its (current) data is submitted to Coop, it comes
 * in without any validation or normalization having been performed on it. So,
 * we use the `RawItemSubmission` to represent items in this state.
 *
 * Then, once the item has been validated and normalized, and we've assigned it
 * an id, filled in some legacy properties (like `creator`), etc., we use the
 * `ItemSubmission` type below to represent that.
 *
 * This type should only be instantiated through either the
 * {@link rawItemSubmissionToItemSubmission} or the
 * {@link submissionDataToItemSubmission} functions below, in order to ensure
 * that the ItemSubmission is instantiated correctly, with validation, a proper
 * id, etc. See those functions for details.
 */
export type ItemSubmission<Type extends ItemType = ItemType> = Opaque<
  {
    /**
     * This is a unique, opaque id we assign to every submission, to track it.
     */
    readonly submissionId: SubmissionId;

    /**
     * We store the time when the submission was received because we want some
     * way to _order_ submissions so that, when rendering an item to the
     * user (e.g., in the thread summary in MRT), we can show the submission
     * for that item that has the most up-to-date data.
     *
     * If we assume that, whenenver a user submits an item to us, they're
     * submitting the most recent version's of the item's data, then the
     * submission with the most recent data will also be the one we received
     * most recently, so we can show that one. We track this with
     * `submissionTime`.
     *
     * Strictly speaking, the assumption that the user will always submit
     * the latest version of an item's data is unsafe, if the user generates
     * submissions from multiple data systems that are themselves only
     * eventually consistent. However, the only workaround for that would be for
     * us to allow users to provide a field in the item data indicating its
     * version, and we don't currently have a schema field role for that;
     * moreover, even if we did, it would be optional for users to use it,
     * so we're always gonna want to use submission time as a baseline ordering
     * scheme.
     *
     * Submission time is optional because we'd have to do some semi-involved
     * Snowflake migrations to populate it on existing submissions. However, the
     * intention is to store it for all new submissions going forward (although
     * that's unfortunately difficult to enforce). Submissions for the same item
     * without a `submissionTime` have undefined ordering.
     *
     * NB: Submission time is very different from the "created at" time given in
     * the item's data. "Created at" represents when the item was created -- not
     * when it was submitted to us -- so, if the item is edited by an end user
     * on the platform side, it's "created at" should not change (if the
     * user is populating that field correctly). I.e., all the submissions
     * for a given item should actually have the same created at -- which is
     * critical for keeping items properly positioned in a thread after they're
     * edited -- but different submission times.
     */
    readonly submissionTime?: Date;

    /**
     * The ItemIdentifier for the user that created this item.
     *
     * NB: this only applies to content items; user items don't list the user as
     * the item's creator, and threads don't (yet) have creators.
     *
     * NB: this could be generated from the schema and field roles on the
     * itemType, but to support older users who submitted the creator as a
     * separate field outside the item data (before schemaFieldRoles existed),
     * we maintain this field explicitly, and all downstream users should
     * use it for now.
     */
    readonly creator: Readonly<ItemIdentifier> | undefined;

    /**
     * This id is meaningless on its own! However, with `itemType.id`, it forms
     * the `ItemIdentifier` for the item that this submission is about.
     */
    readonly itemId: string;

    /**
     * The (current) data of the item, already parsed, validated and normalized.
     */
    readonly data: NormalizedItemData;

    /**
     * The itemType for the item, which lets us uniquely identify it (by
     * combining `itemType.id` with `itemId`) and lets us interpret its data,
     * through the `schema` and `schemaFieldRoles` on the item type.
     */
    readonly itemType: Type;
  },
  'ItemSubmission'
>;

/**
 * This function instantiates an ItemSubmission opaque type from stored
 * submission data.
 *
 * It accepts creatorId and creatorTypeId as separate inputs in order to
 * populate the `ItemSubmission.creator` when creating an `ItemSubmission` from
 * legacy a Snowflake row. In those rows, the creator info is only stored in
 * separate columns (i.e., it's not part of the item data). Once we add the
 * creator info to the data in these legacy submissions, we can remove creatorId
 * and creatorTypeId as explicit arguments. Until then, we make them required to
 * make sure that queries whose results are passed to this function can't forget
 * to select those columns.
 *
 * When this is called with new records as it's input, where the data does hold
 * the creator (e.g., in the REPORTS snowflake table), creatorId and
 * creatorTypeId can be explicitly set null, and the function will look in the
 * data to try to fill in the creator.
 */
export async function submissionDataToItemSubmission(
  getItemType: (it: {
    orgId: string;
    typeSelector: ItemTypeSelector;
  }) => Promise<ReadonlyDeep<ItemType> | undefined>,
  it: {
    orgId: string;
    submissionId: SubmissionId;
    submissionTime?: Date;
    itemId: string;
    itemTypeId: string;
    itemTypeVersion: string;
    itemTypeSchemaVariant: ItemTypeSchemaVariant;
    data: NormalizedItemData;
  } & (
    | { creatorId: string; creatorTypeId: string }
    | { creatorId: null; creatorTypeId: null }
  ),
) {
  const { orgId, itemTypeId, itemTypeVersion, itemTypeSchemaVariant } = it;
  const itemType = await getItemType({
    orgId,
    typeSelector: {
      id: itemTypeId,
      version: itemTypeVersion,
      schemaVariant: itemTypeSchemaVariant,
    },
  });

  if (!itemType) {
    throw new Error('Item type not found for ID: ' + itemTypeId);
  }

  return instantiateOpaqueType<ItemSubmission>({
    submissionId: it.submissionId,
    submissionTime: it.submissionTime,
    itemId: it.itemId,
    creator: it.creatorId
      ? { id: it.creatorId, typeId: it.creatorTypeId }
      : getCreator(itemType, it.data),
    data: it.data,
    itemType,
  });
}

/**
 * This instantiates a new ItemSubmission from the raw, unvalidated data we
 * actually receive from users. It's meant to be used when a submission
 * first enters our system, as it assigns the submissionId and does validation.
 *
 * It's _not_ meant to be used when we're reconstituting an ItemSubmission from
 * stored data (e.g., in Snowflake), as we don't want to assign a new
 * SubmissionId in that case. For that, see {@link submissionDataToItemSubmission}.
 */
export async function rawItemSubmissionToItemSubmission(
  allCurrentItemTypeVersionsForOrg: readonly ItemType[],
  orgId: string,
  getItemTypeEventuallyConsistent: GetItemTypeEventuallyConsistent,
  rawItemSubmission: RawItemSubmission,
): Promise<
  | {
      itemSubmission?: Omit<UnwrapOpaque<ItemSubmission>, 'data'> & {
        data: RawItemData;
      };
      error: AggregateError;
    }
  | {
      itemSubmission: ItemSubmission;
      error: undefined;
    }
> {
  const submissionId = makeSubmissionId();
  const submissionTime = new Date();

  const typeSelector =
    'type' in rawItemSubmission
      ? {
          id: rawItemSubmission.type.id,
          version: rawItemSubmission.type.version,
          schemaVariant: rawItemSubmission.type.schemaVariant,
        }
      : {
          id: rawItemSubmission.typeId,
          version: rawItemSubmission.typeVersion,
          schemaVariant: rawItemSubmission.typeSchemaVariant,
        };

  // Get the Item Type instead of finding it in allItemTypesForOrg because the
  // ItemTypes in allItemTypesForOrg refers only to the latest original versions
  const itemType = await getItemTypeEventuallyConsistent({
    orgId,
    typeSelector,
  });

  if (itemType === undefined) {
    return {
      error: new AggregateError([
        makeBadRequestError(
          `We could not find an Item Type created by your organization with ID: ${typeSelector.id}`,
          {
            type: [ErrorType.DataInvalidForItemType],
            shouldErrorSpan: true,
          },
        ),
      ]),
    };
  }

  // Validate item data
  const normalizedDataOrValidationErrors = toNormalizedItemDataOrErrors(
    allCurrentItemTypeVersionsForOrg.map((it) => it.id),
    itemType,
    rawItemSubmission.data,
  );

  if (Array.isArray(normalizedDataOrValidationErrors)) {
    // Put each error on a separate line, prefixed with 'Error: '
    return {
      itemSubmission: {
        submissionId,
        submissionTime,
        itemId: rawItemSubmission.id,
        data: rawItemSubmission.data,
        creator: undefined,
        itemType,
      },
      error: new AggregateError(normalizedDataOrValidationErrors),
    };
  }

  return {
    itemSubmission: instantiateOpaqueType<ItemSubmission>({
      submissionId,
      submissionTime,
      itemId: rawItemSubmission.id,
      creator: getCreator(itemType, normalizedDataOrValidationErrors),
      data: normalizedDataOrValidationErrors,
      itemType,
    }),
    error: undefined,
  };
}

function getCreator(itemType: ItemType, itemData: NormalizedItemData) {
  switch (itemType.kind) {
    case 'THREAD':
    case 'USER':
      return undefined;
    case 'CONTENT':
      return getFieldValueForRole(
        itemType.schema,
        itemType.schemaFieldRoles,
        'creatorId',
        itemData,
      );
    default:
      assertUnreachable(itemType);
  }
}

/**
 * The unique id we assigned to the submission.
 *
 * To ensure uniqueness and unguessability, we now generate these as UUID v4s.
 * However, we previously used a mix of uuid v1 (our code's old default), uuid
 * v4 (when backfilling some rows in snowlfake), and (due to bugs) some strings
 * that weren't uuids at all. Therefore, code consuming SubmissionIds can't
 * assume anything about it other than that it's a unique, opaque string.
 *
 * We briefly considered generating these as uuid v1s going forward, to remove
 * the need to store `submissionTime` separately, but needing to handle the both
 * uuid v1 ids and the legacy non-uuid ids mentioned above wouldn't have been
 * worth the effort. Moreover, uuid v1s have some potential security
 * vulnerabilities, in that they have no randomness between successive id
 * generations and leak some information about the generating host. So, we chose
 * to stick with v4 uuids going forward and add `submissionTime` instead to get
 * the "submission ordering" benefits that a uuid v1 would've offered.
 */
export type SubmissionId = Opaque<string, 'SubmissionId'>;

/**
 * See {@link SubmissionId} for details.
 *
 * NB: calling code cannot assume that the SubmissionId is always a uuidv4.
 */
export function makeSubmissionId() {
  return instantiateOpaqueType<SubmissionId>(uuidv4());
}
