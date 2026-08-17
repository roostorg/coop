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
  occurredAt: Date;
}

export interface UserStrikeActionRecord {
  actionId: string;
  itemId: string;
  itemTypeId: string;
  source: string;
  occurredAt: Date;
}

export interface ItemActionHistoryInput {
  orgId: string;
  itemId: string;
  itemTypeId: string;
  itemSubmissionTime?: Date;
}

/**
 * Position in the moderator action feed. Composite because timestamps collide —
 * a `ts`-only cursor either skips rows sharing the boundary instant or repeats
 * them, and the exclusion set that patches around that grows without bound.
 */
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
  /**
   * How far back a single fetch may scan, relative to the cursor.
   * `ACTION_EXECUTIONS` is partitioned by `ds`, so without a floor every page
   * reads all partitions older than the cursor.
   */
  lookbackWindowMs?: number;
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
  /** `(item, action)` executions that failed after retries. */
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
  /**
   * How far back of `occurredAt` to scan. Must be at least the feed query's
   * lookback, or a run's row and its own item list disagree — the feed groups
   * over the whole window while this would group over a narrower one, silently
   * dropping items and their failures. Defaults to the feed's window.
   */
  lookbackWindowMs?: number;
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
