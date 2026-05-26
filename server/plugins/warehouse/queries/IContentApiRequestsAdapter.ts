import type { ItemIdentifier } from '@roostorg/types';

export interface ContentApiRequestRecord {
  submissionId: string;
  itemData: unknown;
  itemTypeVersion: string;
  itemTypeSchemaVariant: string;
  itemCreatorId: string | null;
  itemCreatorTypeId: string | null;
  occurredAt: Date;
}

export interface ContentApiRequestQueryOptions {
  latestOnly?: boolean;
  lookbackWindowMs?: number;
}

export interface ContentApiRequestCountRecord {
  date: string;
  count: number;
}

export interface ContentApiImageCountRecord {
  date: string;
  count: number;
}

export interface InferredUserIdentityFromCreatorsInput {
  orgId: string;
  itemId: string;
  lookbackWindowMs?: number;
}

export interface InferredUserIdentityFromCreatorsRecord {
  itemTypeId: string;
  lastSeenAt: Date;
}

export interface IContentApiRequestsAdapter {
  getSuccessfulRequestsForItem(
    orgId: string,
    item: ItemIdentifier,
    options?: ContentApiRequestQueryOptions,
  ): Promise<ReadonlyArray<ContentApiRequestRecord>>;

  getSuccessfulRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiRequestCountRecord>>;

  getImageRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiImageCountRecord>>;

  /**
   * Infer the user `itemTypeId` from rows where `item_creator_id = itemId`.
   * Returns the most-recent `item_creator_type_id` or `null`.
   */
  findInferredUserIdentityFromCreators(
    input: InferredUserIdentityFromCreatorsInput,
  ): Promise<InferredUserIdentityFromCreatorsRecord | null>;
}
