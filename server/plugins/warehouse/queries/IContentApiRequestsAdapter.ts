import type { ItemIdentifier } from '@roostorg/coop-types';

export interface ContentApiRequestRecord {
  submissionId: string;
  itemData: unknown;
  itemTypeVersion: string;
  itemTypeSchemaVariant: string;
  itemCreatorId: string | null;
  itemCreatorTypeId: string | null;
  occurredAt: Date;
}

/**
 * Like {@link ContentApiRequestRecord} but also carries the item's identity,
 * since IP-based lookups can return submissions across many different items
 * (and item types).
 */
export interface ContentApiRequestByIpRecord extends ContentApiRequestRecord {
  itemId: string;
  itemTypeId: string;
}

export interface ContentApiRequestQueryOptions {
  latestOnly?: boolean;
  lookbackWindowMs?: number;
  limit?: number;
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

  /**
   * Returns successful submissions whose denormalized `item_ip_address` matches
   * the given IP, ordered most-recent first. Used by investigation to find every
   * item associated with an IP beyond Scylla's TTL window.
   */
  getSuccessfulRequestsByIpAddress(
    orgId: string,
    ipAddress: string,
    options?: ContentApiRequestQueryOptions,
  ): Promise<ReadonlyArray<ContentApiRequestByIpRecord>>;

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
