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
}

