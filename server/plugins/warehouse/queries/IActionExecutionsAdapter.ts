import type { JsonObject } from 'type-fest';

export interface ItemActionHistoryRecord {
  actionId: string;
  itemId: string;
  itemTypeId: string;
  actorId: string | null;
  jobId: string | null;
  userId: string | null;
  userTypeId: string | null;
  policies: readonly string[];
  ruleIds: readonly string[];
  /**
   * Moderator-supplied parameter values the action ran with, keyed by the
   * parameter's `name`. Always an object: executions that took no parameters,
   * predate parameter capture, or stored an unreadable value all read back as
   * `{}` so consumers don't have to distinguish those cases.
   */
  parameters: JsonObject;
  occurredAt: Date;
}

export interface UserStrikeActionRecord {
  actionId: string;
  itemId: string;
  itemTypeId: string;
  creatorId: string | null;
  creatorTypeId: string | null;
  source: string;
  occurredAt: Date;
}

export interface ItemActionHistoryInput {
  orgId: string;
  itemId: string;
  itemTypeId: string;
  itemSubmissionTime?: Date;
}

export interface ModeratorActionCursor {
  /** `max(ts)` of the last group already returned. */
  ts: Date;
  correlationId: string;
}

export interface RecentModeratorActionsInput {
  orgId: string;
  /** Absent for the newest page. */
  cursor?: ModeratorActionCursor;
  /** Inclusive lower bound on `max(ts)`, from a user-set date range. */
  after?: Date;
  /** Inclusive upper bound on `max(ts)`, from a user-set date range. */
  before?: Date;
  limit: number;
  /** Restrict to actions taken by these moderators. */
  actorIds?: readonly string[];
  /** Restrict to actions carrying at least one of these policies. */
  policyIds?: readonly string[];
  /** Restrict to operations that touched this item. */
  itemId?: string;
}

/**
 * One moderator operation, collapsed from the many `(item, action)` rows it
 * wrote. A single bulk submit of 500 ids with 2 actions selected produces 1,000
 * rows sharing one `correlation_id`; this is that operation as one record.
 */
export interface ModeratorActionGroupRecord {
  correlationId: string;
  actorId: string | null;
  itemTypeId: string | null;
  actionIds: readonly string[];
  policyIds: readonly string[];
  actorNote: string | null;
  /** Distinct items the operation touched. Exact, not estimated. */
  itemCount: number;
  /** Distinct items with an execution that failed after retries. */
  failedCount: number;
  occurredAt: Date;
}

export interface ManualActionItemsInput {
  orgId: string;
  correlationId: string;
  /**
   * `max(ts)` of the operation, from the feed row. Bounds the partition scan —
   * `correlation_id` is not in the table's sort key, so without this every
   * lookup scans the whole retention window.
   */
  occurredAt: Date;
  limit: number;
  offset: number;
}

export interface ManualActionItemRecord {
  itemId: string;
  itemTypeId: string | null;
  failed: boolean;
}

export interface ManualActionItemsResult {
  items: readonly ManualActionItemRecord[];
  totalCount: number;
}

export interface UserStrikeActionsInput {
  orgId: string;
  filterBy?: {
    startDate?: Date;
    endDate?: Date;
  };
  limit?: number;
}

export interface InferredUserIdentityInput {
  orgId: string;
  itemId: string;
  lookbackWindowMs?: number;
}

export interface InferredUserIdentityRecord {
  itemTypeId: string;
  lastSeenAt: Date;
}

export interface ContentCreatorIdentityInput {
  orgId: string;
  /** Id of the content item whose creator we want to resolve. */
  itemId: string;
  /** Type id of the content item; required to disambiguate id collisions. */
  itemTypeId: string;
  lookbackWindowMs?: number;
}

export interface ContentCreatorIdentityRecord {
  creatorId: string;
  creatorTypeId: string;
  lastSeenAt: Date;
}

export interface IActionExecutionsAdapter {
  getItemActionHistory(
    input: ItemActionHistoryInput,
  ): Promise<ReadonlyArray<ItemActionHistoryRecord>>;

  /**
   * Feed of actions a moderator took outside a review job — from Bulk
   * Actioning or Investigation. These never produce a `manual_review_decisions`
   * row, so this is the only record of them.
   */
  getRecentModeratorActions(
    input: RecentModeratorActionsInput,
  ): Promise<ReadonlyArray<ModeratorActionGroupRecord>>;

  /** Every item one moderator operation touched, paged. */
  getManualActionItems(
    input: ManualActionItemsInput,
  ): Promise<ManualActionItemsResult>;

  getRecentUserStrikeActions(
    input: UserStrikeActionsInput,
  ): Promise<ReadonlyArray<UserStrikeActionRecord>>;

  /** Infer the user `itemTypeId` for an id with no submission record. */
  findInferredUserIdentity(
    input: InferredUserIdentityInput,
  ): Promise<InferredUserIdentityRecord | null>;

  /**
   * Resolve the creator `(id, typeId)` for a CONTENT item by finding the
   * most-recent action-execution row matching `(item_id, item_type_id)` and
   * projecting its creator columns. Returns `null` when no row has non-empty
   * creator fields.
   */
  findContentCreatorIdentity(
    input: ContentCreatorIdentityInput,
  ): Promise<ContentCreatorIdentityRecord | null>;
}
