import type {
  ConditionInput,
  ConditionSet,
} from '../moderationConfigService/index.js';

export {
  default as makeAggregationsService,
  AggregationsService,
  evaluateAggregationRuntimeArgsForItem,
} from './AggregationsService.js';

export {
  default as makeKeyValueStore,
  StringNumberKeyValueStore,
} from './StringNumberKeyValueStore.js';

export type AggregationGroupByInput =
  | { type: 'USER_ID' }
  | { type: 'CONTENT_FIELD'; name: string; contentTypeId: string };

export type AggregationClause = {
  id: string;
  conditionSet?: ConditionSet | null;
  aggregation: Aggregation;
  groupBy: ConditionInput[];
  window: WindowConfiguration;
};

export type Aggregation = { type: 'COUNT' };

// WindowConfiguration specifies the size and hop of a hopping window.
// A hopping window of sizeMs is similar to a sliding window of sizeMs,
// but counts are stored in discrete buckets of size hopMs, which is generally
// some fraction of sizeMs. This is drastically more efficient than storing
// all timestamps and computing sliding windows and still allows for sliding
// window queries.
export type WindowConfiguration = {
  sizeMs: number;
  hopMs: number;
};

// NB: We support only a subset of scalar types for group by.
// This is mostly because we need to be able to stringify the values.
// This list is not enforced by anything in the graphql schema, and therefore
// it's up to the client to prevent the user from grouping by unsupported types.
export const SupportedAggregationGroupByScalarTypes = [
  'USER_ID',
  'ID',
  'STRING',
] as const;
export type SupportedAggregationGroupByScalarType =
  (typeof SupportedAggregationGroupByScalarTypes)[number];

export type AggregationRuntimeArgsForItem = {
  createdAt: Date; // The time the item was created.
  groupByValueStrings: string[]; // Values of group by fields as strings.
};
