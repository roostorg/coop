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
