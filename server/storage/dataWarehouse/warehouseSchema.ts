/**
 * Data Warehouse Schema Types
 *
 * Defines Kysely-compatible types for data warehouse tables.
 * These types are used by query adapters and services to build
 * type-safe queries against the data warehouse.
 */
import { type ItemTypeKind } from '@roostorg/types';
import { type ColumnType } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';

import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import {
  type NormalizedItemData,
  type RawItemData,
  type SubmissionId,
} from '../../services/itemProcessingService/index.js';
import { type ManualReviewToolServiceWarehouseSchema } from '../../services/manualReviewToolService/index.js';
import {
  type ItemSchema,
  type ItemTypeSchemaVariant,
  type SchemaFieldRoles,
} from '../../services/moderationConfigService/index.js';
import { type ReportingServiceWarehouseSchema } from '../../services/reportingService/index.js';
import { type JsonOf } from '../../utils/encoding.js';
import { getUtcDateOnlyString, type DateOnlyString } from '../../utils/time.js';
import { type NullableKeysOf } from '../../utils/typescript-types.js';
import { type ConditionSetWithResultAsLogged } from '../../services/analyticsLoggers/index.js';

import {
  type FilterableWarehouseDate,
  type WarehouseDate,
} from './warehouseDateTypes.js';

export type {
  FilterableWarehouseDate,
  WarehouseDate,
} from './warehouseDateTypes.js';

// Kysely types for data warehouse tables in the public schema.
// These are considered fair game for the whole app to access; types for
// tables in other schemas are defined by the service that owns that schema.
//
// Each table is registered both as `PUBLIC.TABLE_NAME` and just `TABLE_NAME`,
// so queries can reference it with or without the schema prefix.
export type DataWarehousePublicSchema = UnprefixedPublicTables & {
  [K in keyof UnprefixedPublicTables as `PUBLIC.${K}`]: UnprefixedPublicTables[K];
};

/** Convert a warehouse driver date to a standard Date object. */
export function warehouseDateToDate(date: WarehouseDate | DateOnlyString) {
  return new Date(date as unknown as Date | string);
}

/** Convert a warehouse driver date to an ISO JSON string. */
export function warehouseDateToJson(it: WarehouseDate | DateOnlyString) {
  return typeof it === 'string' ? new Date(it).toISOString() : it.toISOString();
}

export function warehouseDateToDateOnlyString(it: WarehouseDate | DateOnlyString) {
  return typeof it === 'string' ? it : getUtcDateOnlyString(warehouseDateToDate(it));
}

type UnprefixedPublicTables = {
  ALL_ORGS: AllOrgsRow;
  CONTENT_API_REQUESTS: ItemSubmissionsRow;
  CONTENT_DETAILS_API_REQUESTS: ContentDetailsRequestsRow;
  RULE_EXECUTIONS: RuleExecutionsRow;
  RULE_EXECUTION_STATISTICS: RuleExecutionsStatisticsRow;
  ACTION_EXECUTIONS: ActionExecutionsRow;
  ITEM_MODEL_SCORES_LOG: ItemModelScoresRow;
};

export type AllOrgsRow = {
  ID: ColumnType<string, string, never>;
  NAME: string;
  EMAIL: string;
  WEBSITE_URL: string;
  DATE_CREATED: ColumnType<WarehouseDate, never, never>;
};

/**
 * Transforms a table row type into the shape expected for bulk/eventual writes
 * (e.g. via Kafka ingestion). Keys are lowercased and nullable keys become
 * optional. The `AcceptSlowQueries` flag controls whether JSON null values are
 * permitted (they can degrade columnar storage performance).
 */
export type BulkWriteType<
  T extends
    | ItemSubmissionsRow
    | ItemModelScoresRow
    | RuleExecutionsRow
    | ActionExecutionsRow
    | ManualReviewToolServiceWarehouseSchema[keyof ManualReviewToolServiceWarehouseSchema]
    | ReportingServiceWarehouseSchema[keyof ReportingServiceWarehouseSchema],
  AcceptSlowQueries extends boolean,
> = UnsafeBulkWriteType<T> &
  (AcceptSlowQueries extends true ? unknown : WarehouseFastData);

export type UnsafeBulkWriteType<
  T extends
    | ItemSubmissionsRow
    | ItemModelScoresRow
    | RuleExecutionsRow
    | ActionExecutionsRow
    | ManualReviewToolServiceWarehouseSchema[keyof ManualReviewToolServiceWarehouseSchema]
    | ReportingServiceWarehouseSchema[keyof ReportingServiceWarehouseSchema],
> = {
  [K in Exclude<
    keyof T & string,
    NullableKeysOf<T>
  > as Lowercase<K>]: T[K] extends ColumnType<
    unknown,
    infer InsertType,
    unknown
  >
    ? InsertType
    : T[K];
} & {
  [K in NullableKeysOf<T> & string as Lowercase<K>]?: T[K] extends ColumnType<
    unknown,
    infer InsertType,
    unknown
  >
    ? InsertType
    : T[K];
};

export type BulkWriteTable =
  | 'ACTION_EXECUTIONS'
  | 'CONTENT_API_REQUESTS'
  | 'REPORTING_SERVICE.REPORTS'
  | 'REPORTING_SERVICE.APPEALS'
  | 'RULE_EXECUTIONS'
  | 'MANUAL_REVIEW_TOOL.ROUTING_RULE_EXECUTIONS'
  | 'ITEM_MODEL_SCORES_LOG'
  | 'REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS';

export type ItemSubmissionsRow = {
  ORG_ID: string;
  REQUEST_ID: string;
  SUBMISSION_ID: SubmissionId;
  ITEM_ID: string;
  ITEM_TYPE_NAME: string;
  ITEM_TYPE_KIND: ItemTypeKind;
  ITEM_TYPE_VERSION: string;
  ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant;
  ITEM_TYPE_SCHEMA_FIELD_ROLES: SchemaFieldRoles;
  ITEM_TYPE_ID: string;
  ITEM_TYPE_SCHEMA: JsonOf<ItemSchema>;
  TS: ColumnType<WarehouseDate, number, never>;
  DS: ColumnType<FilterableWarehouseDate, string, never>;
} & (
  | {
      EVENT: 'REQUEST_SUCCEEDED';
      ITEM_DATA: JsonOf<NormalizedItemData>;
      FAILURE_REASON: null;
    }
  | {
      EVENT: 'REQUEST_FAILED';
      ITEM_DATA: JsonOf<RawItemData> | JsonOf<NormalizedItemData>;
      FAILURE_REASON: string;
    }
) &
  (
    | {
        ITEM_CREATOR_ID: string;
        ITEM_CREATOR_TYPE_ID: string;
      }
    | {
        ITEM_CREATOR_ID: null;
        ITEM_CREATOR_TYPE_ID: null;
      }
  );

export type ItemModelScoresRow = {
  ORG_ID: string;
  SUBMISSION_ID: SubmissionId;
  ITEM_ID: string;
  ITEM_TYPE_NAME: string;
  ITEM_TYPE_KIND: ItemTypeKind;
  ITEM_TYPE_VERSION: string;
  ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant;
  ITEM_TYPE_SCHEMA_FIELD_ROLES: SchemaFieldRoles;
  ITEM_TYPE_ID: string;
  ITEM_TYPE_SCHEMA: JsonOf<ItemSchema>;
  TS: ColumnType<WarehouseDate, number, never>;
  DS: ColumnType<FilterableWarehouseDate, string, never>;
} & (
  | {
      EVENT: 'REQUEST_SUCCEEDED';
      ITEM_DATA: JsonOf<NormalizedItemData>;
      FAILURE_REASON: null;
      MODEL_ID: string;
      MODEL_VERSION: number;
      MODEL_SCORE?: number | null;
    }
  | {
      EVENT: 'REQUEST_FAILED';
      ITEM_DATA: JsonOf<RawItemData> | JsonOf<NormalizedItemData>;
      FAILURE_REASON: string;
      MODEL_ID: null;
      MODEL_VERSION: null;
      MODEL_SCORE: null;
    }
) &
  (
    | {
        ITEM_CREATOR_ID: string;
        ITEM_CREATOR_TYPE_ID: string;
      }
    | {
        ITEM_CREATOR_ID: null;
        ITEM_CREATOR_TYPE_ID: null;
      }
  );

type ContentDetailsRequestsRow = {
  /* TODO. Define fields + migrate to make columns non-nullable as appropriate. */
};

export type RuleExecutionsRow = {
  RULE: string;
  RULE_ID: string;
  RULE_VERSION: string | null;
  ORG_ID: string;
  ENVIRONMENT: RuleEnvironment;
  CORRELATION_ID: string | null;

  POLICY_IDS: readonly string[];
  POLICY_NAMES: readonly string[];
  TAGS: readonly string[];

  RESULT: JsonOf<ConditionSetWithResultAsLogged> | null;
  PASSED: boolean;
  TS: ColumnType<WarehouseDate, number, never>;
  DS: ColumnType<FilterableWarehouseDate, string, never>;

  ITEM_ID: string;
  ITEM_TYPE_ID: string;
  ITEM_TYPE_KIND: ItemTypeKind;
  ITEM_TYPE_SCHEMA: JsonOf<ItemSchema> | null;
  ITEM_TYPE_SCHEMA_FIELD_ROLES: SchemaFieldRoles | null;
  ITEM_TYPE_VERSION: string | null;
  ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant | null;
} & (
  | {
      ITEM_DATA: JsonOf<NormalizedItemData>;
      ITEM_SUBMISSION_ID: SubmissionId;
      ITEM_TYPE_NAME: string;
      ITEM_CREATOR_ID: string | null;
      ITEM_CREATOR_TYPE_ID: string | null;
    }
  | {
      ITEM_DATA: null;
      ITEM_SUBMISSION_ID: null;
      ITEM_TYPE_NAME: null;
      ITEM_CREATOR_ID: null;
      ITEM_CREATOR_TYPE_ID: null;
    }
);

export type ActionExecutionPolicy = {
  id: string;
  name: string;
  userStrikeCount: number;
  penalty?: string;
};

export type ActionExecutionMatchingRule = {
  id: string;
  name: string;
  version: string;
  tags?: string[];
  policies: ActionExecutionPolicy[];
};

type ActionExecutionsRow = {
  ORG_ID: string;
  ACTION_ID: string;
  ACTION_NAME: string;
  ITEM_CREATOR_ID: string | null;
  ITEM_CREATOR_TYPE_ID: string | null;
  ITEM_TYPE_ID: string | null;
  ITEM_SUBMISSION_ID: SubmissionId | null;
  ITEM_ID: string | null;
  ITEM_TYPE_KIND: string;
  RULES: ReadonlyDeep<ActionExecutionMatchingRule[]> | null;
  RULE_TAGS: string[] | null;
  RULE_ENVIRONMENT: RuleEnvironment | null;
  CORRELATION_ID: string;
  ACTION_SOURCE: string;
  ACTOR_ID: string | null;
  POLICIES: ReadonlyDeep<ActionExecutionPolicy[]>;
  FAILED: boolean;
  JOB_ID: string | null;
  TS: ColumnType<WarehouseDate, number, never>;
  DS: ColumnType<FilterableWarehouseDate, string, never>;
};

type RuleExecutionsStatisticsRow = {
  ORG_ID: string;
  RULE_ID: string;
  RULE_VERSION: WarehouseDate;
  NUM_PASSES: number;
  NUM_RUNS: number;
  TS_START_INCLUSIVE: WarehouseDate;
  TS_END_EXCLUSIVE: WarehouseDate;
  ENVIRONMENT: string | null;
  RULE_POLICY_NAMES: string[] | null;
  RULE_POLICY_IDS: string[] | null;
  RULE_TAGS: string[] | null;
};

/**
 * Enforces that data objects written to the warehouse do not contain JSON
 * null values. Excluding nulls keeps columnar storage performance optimal
 * by avoiding mixed-type columns. Keys with undefined values are fine as
 * they are omitted during serialization.
 */
type WarehouseFastData = {
  [x: string]: JSONStringifyableWithoutNull | undefined;
};

type JSONStringifyableWithoutNull =
  | { readonly [key: string]: JSONStringifyableWithoutNull | undefined }
  | readonly [JSONStringifyableWithoutNull, ...JSONStringifyableWithoutNull[]]
  | readonly JSONStringifyableWithoutNull[]
  | number
  | string
  | boolean;
