import { type ItemTypeKind } from '@roostorg/types';
import { type ColumnType } from 'kysely';
import { type ReadonlyDeep } from 'type-fest';

import { type RuleEnvironment } from '../rule_engine/RuleEngine.js';
import {
  type NormalizedItemData,
  type RawItemData,
  type SubmissionId,
} from '../services/itemProcessingService/index.js';
import { type ManualReviewToolServiceSnowflakeSchema } from '../services/manualReviewToolService/index.js';
import {
  type ItemSchema,
  type ItemTypeSchemaVariant,
  type SchemaFieldRoles,
} from '../services/moderationConfigService/index.js';
import { type ReportingServiceSnowflakeSchema } from '../services/reportingService/index.js';
import { type JsonOf } from '../utils/encoding.js';
import { getUtcDateOnlyString, type DateOnlyString } from '../utils/time.js';
import { type NullableKeysOf } from '../utils/typescript-types.js';
import { type ConditionSetWithResultAsLogged } from '../services/analyticsLoggers/index.js';

// We build our Snowflake queries (especially those that have dynamic portions,
// like conditionally-applied WHERE clauses) using `kysely`. So, here we define
// types for our snowflake tables that kysely needs in order to validate our
// queries and catch broken queries after a refactor.
//
// NB: these are only types for the snowflake tables in the _public_ schema,
// which are considered fair game for the whole app to access; the types for
// tables in other schemas are defined in the service that owns that schema.
//
// For each of these tables, we register it as `PUBLIC.TABLE_NAME` and just
// `TABLE_NAME`, so that we can query it with kysely with or w/o the reference
// to the schema (which doesn't need to be referenced explicitly because PUBLIC
// is the default schema, and the one we connect to snowflake with).
export type SnowflakePublicSchema = UnprefixedSnowflakePublicTables & {
  [K in keyof UnprefixedSnowflakePublicTables as `PUBLIC.${K}`]: UnprefixedSnowflakePublicTables[K];
};

/**
 * The official Snowflake driver for Nodejs returns DATE and TIMESTAMP columns
 * as special SfDate and SfTimestamp objects, which extend the JS Date object.
 * This is necessary in part because timestamps in SQL can have higher precision
 * than JS Date objects, which Snowflake wants clients to be able to access, and
 * in part because Snowflake wants to override the default `toString` + `toJSON`
 * methods on the returned values -- I think so they respect Snowflake's
 * [`DATE_OUTPUT_FORMAT`](https://docs.snowflake.com/sql-reference/parameters#label-date-output-format)
 * parameter. However, this override of `toJSON` means that it's really not safe
 * to treat SfDates as standard Dates -- hello LSP violation! -- as there's
 * unexpected results/breakage when a Snowflake-returned date/time is
 * serialized. To help prevent that, we define this special SfDate type, which
 * makes it impossible to call the unsafe `toJSON` method. For now, we don't
 * expose the custom SfDate methods on this type, since we don't really want to
 * depend on those (e.g., if we switch off Snowflake), and we don't need them
 * for anything. We also define helper functions that can properly convert an
 * SfDate to a standard Date object or to JSON (using the standard format of
 * native Date objects).
 */
export type SfDate = Omit<Date, 'toJSON'>;

/**
 * Kysely allows using a different type for a column's value on SELECT, INSERT,
 * and UPDATE queries. But, it does _not_ support defining a different type for
 * column's value when that column is returned from a SELECT query vs when a
 * value is provided to filter on that column in a WHERE clause. In the case of
 * date columns, that creates a problem, because we often filter with a string
 * (using a string containing just the date, to make sure that we don't get
 * timezone-related issues), but then we get back an SfDate object. To
 * accommodate this, Kysely requires us to indicate that the type for both WHERE
 * and SELECT is something like `string | SfDate`. That's not ideal, though, as
 * we could accidentally have a snowflake query result that's an SfDate, but
 * pass it to a function that accepts string. So, we make that much less likely
 * by also having an opaque type for the date strings that we use in our filters.
 */
export type FilterableSfDate = SfDate | DateOnlyString;

/**
 * This function converts the custom/augmented Date objects returned by the
 * Snowflake driver into standard Date objects. See {@link SfDate}.
 *
 * In addition to accepting an SfDate, this function accepts a
 * {@link DateOnlyString} for convenience, and it will be able to handle a
 * `DateOnlyString`, but it should probably never be called with one, as this
 * function only makes sense to call on Snowflake results. Accepting a
 * DateOnlyString is really a pragmatic decision based on the same kysely
 * limitation that led to the creation of {@link FilterableSfDate}.
 *
 * @param date The SfDate returned from the driver.
 * @returns Date
 */
export function sfDateToDate(date: SfDate | DateOnlyString) {
  return new Date(date as unknown as Date | string);
}

/**
 * See explanation at {@link SfDate}, {@link FilterableSfDate}, and
 * {@link sfDateToDate}.
 */
export function sfDateToJson(it: SfDate | DateOnlyString) {
  return typeof it === 'string' ? new Date(it).toISOString() : it.toISOString();
}

export function sfDateToDateOnlyString(it: SfDate | DateOnlyString) {
  return typeof it === 'string' ? it : getUtcDateOnlyString(sfDateToDate(it));
}

type UnprefixedSnowflakePublicTables = {
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
  DATE_CREATED: ColumnType<SfDate, never, never>;
};

/**
 * Some tables cannot be written to directly (because they only gets populated
 * in bulk by a periodic snowpipe job). The ingestion job that populates them
 * may expect the data to be given in a slightly different shape than the way
 * it's ultimately stored or needs to be queried. E.g., our snowpipe job expects
 * keys to be lowercase in the provided json blobs, even though the
 * corresponding column names are uppercase. To address this, `BulkWriteType`
 * takes the type of a table and returns the type to use when writing to it w/
 * `snowflakeEventualWrite`. For now, I explicitly limit the generic to tables
 * for which I've verified explicitly that this generates the write type.
 *
 * The use of NullableKeysOf is to allow a key that's nullable in Snowflake to
 * be omitted in the JSON object (which shouldn't contain literal null values;
 * see {@link SnowflakeFastData}).
 */
export type BulkWriteType<
  T extends
    | ItemSubmissionsRow
    | ItemModelScoresRow
    | RuleExecutionsRow
    | ActionExecutionsRow
    | ManualReviewToolServiceSnowflakeSchema[keyof ManualReviewToolServiceSnowflakeSchema]
    | ReportingServiceSnowflakeSchema[keyof ReportingServiceSnowflakeSchema],
  AcceptSlowQueries extends boolean,
> = UnsafeBulkWriteType<T> &
  (AcceptSlowQueries extends true ? unknown : SnowflakeFastData);

export type UnsafeBulkWriteType<
  T extends
    | ItemSubmissionsRow
    | ItemModelScoresRow
    | RuleExecutionsRow
    | ActionExecutionsRow
    | ManualReviewToolServiceSnowflakeSchema[keyof ManualReviewToolServiceSnowflakeSchema]
    | ReportingServiceSnowflakeSchema[keyof ReportingServiceSnowflakeSchema],
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

// Pretty much all the fields that are null below are nullable because they were
// added to the table after it was created, and not backfilled on existing rows.
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
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;
} & (
  | {
      EVENT: 'REQUEST_SUCCEEDED';
      ITEM_DATA: JsonOf<NormalizedItemData>;
      FAILURE_REASON: null;
    }
  | {
      // Content can be unnormalized iff there was an error validating it.
      // However, we also log normalized content if item validation succeeded
      // but there was an error running the rules.
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
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;
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
      // Content can be unnormalized iff there was an error validating it.
      // However, we also log normalized content if item validation succeeded
      // but there was an error running the rules.
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
  RULE: string; // rule name
  RULE_ID: string;
  RULE_VERSION: string | null; // missing on old records
  ORG_ID: string;
  ENVIRONMENT: RuleEnvironment;
  CORRELATION_ID: string | null; // missing on old records

  // NB: these array columns are never null (right now), but can't be marked
  // non-nullable in snowflake because of a snowflake bug.
  // https://community.snowflake.com/s/question/0D53r0000BgPBAKCQ4/cannot-add-not-null-to-a-column-even-though-it-has-no-null-values-whats-up
  POLICY_IDS: readonly string[];
  POLICY_NAMES: readonly string[];
  TAGS: readonly string[];

  RESULT: JsonOf<ConditionSetWithResultAsLogged> | null; // missing on old records
  PASSED: boolean;
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;

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
      // These are the types in the "item identifier as rule input" case
      // (currently only applies in user rules).
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
  // TODO: remove
  penalty?: string;
};

// Represent a rule that passed (in the rule set that triggered this action),
// and that was associated with this action (i.e., its passing contributed to
// the action being triggered). This type is intentionally more limited than the
// Rule + Policy models, to enforce that this service doesn't depend on model
// instance functionality (e.g., saving instances, fetching associations).
export type ActionExecutionMatchingRule = {
  id: string;
  name: string;
  version: string;
  // NB: matchingRule.tags is now required, but it wasn't always, so it's
  // missing in snowflake for some legacy rows. Those row's have had the
  // rule_tags column backfilled on them; just not the tags _for each
  // individual rule. If we ever need to fill in this data, use the following
  // migration as a starting point: 2022.06.09T06.30.20.backfill-action-execution-tags.cjs
  tags?: string[];
  policies: ActionExecutionPolicy[];
};

type ActionExecutionsRow = {
  ORG_ID: string;
  ACTION_ID: string;
  ACTION_NAME: string;
  ITEM_CREATOR_ID: string | null;
  ITEM_CREATOR_TYPE_ID: string | null;

  // Actions can be taken directly on a user (via user rules or through the UI),
  // in which case we _currently_ treat the "item" as null and just fill in
  // USER_ID. So, in that case `item_submission_id` and `item_type_id` will be
  // null. `ITEM_TYPE_ID` will _also_ be null in rows that were created before
  // we added the `CONTENT_TYPE_ID` column (which was the original name of
  // `ITEM_TYPE_ID`). Therefore, YOU CANNOT FILTER BY NULL ITEM_TYPE_ID VALUES
  // TO GET ONLY ACTIONS TAKEN ON USERS.
  ITEM_TYPE_ID: string | null;
  ITEM_SUBMISSION_ID: SubmissionId | null;
  ITEM_ID: string | null;
  ITEM_TYPE_KIND: string;

  // similarly, actions can be triggered directly, without going through a rule.
  RULES: ReadonlyDeep<ActionExecutionMatchingRule[]> | null;
  RULE_TAGS: string[] | null;
  RULE_ENVIRONMENT: RuleEnvironment | null;
  CORRELATION_ID: string;
  ACTION_SOURCE: string;
  ACTOR_ID: string | null;
  POLICIES: ReadonlyDeep<ActionExecutionPolicy[]>;
  FAILED: boolean;
  JOB_ID: string | null;
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;
};

type RuleExecutionsStatisticsRow = {
  ORG_ID: string;
  RULE_ID: string;
  RULE_VERSION: SfDate;
  NUM_PASSES: number;
  NUM_RUNS: number;
  TS_START_INCLUSIVE: SfDate;
  TS_END_EXCLUSIVE: SfDate;
  ENVIRONMENT: string | null;
  RULE_POLICY_NAMES: string[] | null;
  RULE_POLICY_IDS: string[] | null;
  RULE_TAGS: string[] | null;
};

/**
 * Our storage strategy in Snowflake requires that the data objects we first
 * send to ingested_json, and any non-primitive values in that data, don't
 * include include the JSON value `null`.
 *
 * The reasoning for this goes back to a distinction between SQL's NULL and
 * JSON's null. Essentially, NULL in SQL means: 'this value is missing or
 * unknown; its true value (if known) could be anything'. The closest analogue
 * to SQL NULL in JSON would just be excluding the key altogether from the JSON
 * object. However, in JSON, you can _also_ include the key, but with a `null`
 * value. The interpretation of that is application-specific, but it often means
 * a more-affirmative assertion of "there is no value for this thing", rather
 * than "the value is unknown". Oftentimes, programmers are sloppy about this
 * distinction, and that's fine; it usually doesn't matter. However, in
 * Snowflake, it does. The story is that:
 *
 * 1. We're storing the submitted JSON data, and usually objects w/i this data,
 *    in `variant` columns;
 *
 * 2. Snowflake automatically makes a best effort to store _each sub-value_ in a
 *    variant in a way that's similar to how it would store a dedicated column
 *    holding that sub value. E.g., if your table has a variant column `data`,
 *    where all the values loook like `{ "x": "some_string" }`, Snowflake will
 *    actually store that in a way so that queries that reference `data:x` are
 *    ~just as fast as if you'd put the `"x"` values in a dedicated column. It
 *    calls this "columnarization". See https://docs.snowflake.com/en/user-guide/semistructured-considerations.html#semi-structured-data-files-and-columnarization
 *    Cf. https://docs.snowflake.com/en/sql-reference/data-types-semistructured.html#using-values-in-a-variant
 *
 * 3. As part of the columnarization process, it has to pick a data type for the
 *    "column" that it generates. In the example above, the "column" for the "x"
 *    values would have a string type, and that column would be NULLable, in the
 *    SQl sense, to handle the case of a variant value being added that doesn't
 *    have an "x" key at all.
 *
 * 4. However, if the values in the "x" key of the variant data could be a
 *    string _or JSON's null_, then there's no simple SQL column type that can
 *    represent this (i.e., can store NULL, or JSON null, or varchar). So,
 *    Snowflake just gives up on columnarization in this case, and the queries
 *    get a lot slower.
 *
 * For us, we don't really have any use cases (so far) for giving JSON null a
 * different meaning than just leaving the key out of the JSON object sent to
 * Snowflake (and having Snowflake use SQL NULL). So, this type enforces a
 * "no json nulls" rule to make sure that we can't accidentally fall off this
 * performance cliff.
 */
type SnowflakeFastData = {
  [x: string]: JSONStringifyableWithoutNull | undefined;
};

type JSONStringifyableWithoutNull =
  // We can allow object keys to have undefined as their value,
  // as such keys will simply be omitted by JSON.stringify. However,
  // we can't allow undefined in arrays, as that gets serialized as null.
  | { readonly [key: string]: JSONStringifyableWithoutNull | undefined }
  | readonly [JSONStringifyableWithoutNull, ...JSONStringifyableWithoutNull[]]
  | readonly JSONStringifyableWithoutNull[]
  | number
  | string
  | boolean;
