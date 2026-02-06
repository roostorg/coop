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

export interface IActionExecutionsAdapter {
  getItemActionHistory(
    input: ItemActionHistoryInput,
  ): Promise<ReadonlyArray<ItemActionHistoryRecord>>;

  getRecentUserStrikeActions(
    input: UserStrikeActionsInput,
  ): Promise<ReadonlyArray<UserStrikeActionRecord>>;
}

