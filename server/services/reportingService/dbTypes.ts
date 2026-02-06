import { type ItemIdentifier, type ItemTypeKind } from '@roostorg/types';
import { type ColumnType, type GeneratedAlways } from 'kysely';

import { type RuleEnvironment } from '../../rule_engine/RuleEngine.js';
import { type ConditionSetWithResultAsLogged } from '../analyticsLoggers/ruleExecutionLoggingUtils.js';
import { type FilterableSfDate, type SfDate } from '../../snowflake/types.js';
import { type JsonOf } from '../../utils/encoding.js';
import {
  type ItemSubmissionWithTypeIdentifier,
  type NormalizedItemData,
  type SubmissionId,
} from '../itemProcessingService/index.js';
import {
  type ConditionSet,
  type ContentSchemaFieldRoles,
  type ItemSchema,
  type ItemTypeSchemaVariant,
  type SchemaFieldRoles,
  type ThreadSchemaFieldRoles,
  type UserSchemaFieldRoles,
} from '../moderationConfigService/index.js';
import { type ReportingRuleStatus } from './ReportingRules.js';
import { type ReporterKind } from './reportingService.js';

// TODO: migrate REPORTING_SERVICE.REPORTS, and the code that writes to it, to
// use `ItemSubmissionWithItemTypeIdentifier`; the type below is a legacy type
// from before we used item submissions consistently.
type DBReportItemSubmission = {
  id: string;
  submissionId?: SubmissionId; // only present on newer rows.
  data: NormalizedItemData;
  typeIdentifier: {
    id: string;
    version: string;
    schemaVariant: ItemTypeSchemaVariant | 'original' | 'partial';
  };
};

export type ReportSubmissionsRow = {
  ORG_ID: string;
  REQUEST_ID: string;
  // Reporter user ID is nullable for the case where 'reporter type' is 'rule'
  // (meaning it wasn't manually added to the reporting queue by a user)
  REPORTER_USER_ID: string | null;
  REPORTER_KIND: ReporterKind;
  REPORTED_AT: ColumnType<SfDate, Date, never>;
  POLICY_ID: string | null;
  REPORTED_FOR_REASON: string | null;
  TS: ColumnType<SfDate, Date, never>;
  REPORTER_USER_ITEM_TYPE_ID: string | null;
  REPORTED_ITEM_ID: string;
  REPORTED_ITEM_DATA: NormalizedItemData;
  REPORTED_ITEM_TYPE_ID: string;
  REPORTED_ITEM_TYPE_VERSION: ColumnType<string, string, never>;
  REPORTED_ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant;
  REPORTED_ITEM_TYPE_SCHEMA: ItemSchema;
  SKIP_JOB_ENQUEUE: boolean;
} & (
  | {
      REPORTED_ITEM_TYPE_KIND: 'CONTENT';
      REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<ContentSchemaFieldRoles>;
      REPORTED_ITEM_THREAD: null;
      REPORTED_ITEMS_IN_THREAD: null;
      ADDITIONAL_ITEMS: DBReportItemSubmission[];
    }
  | {
      REPORTED_ITEM_TYPE_KIND: 'USER';
      REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<UserSchemaFieldRoles>;
      REPORTED_ITEM_THREAD: DBReportItemSubmission[] | null;
      REPORTED_ITEMS_IN_THREAD: ItemIdentifier[];
      ADDITIONAL_ITEMS: DBReportItemSubmission[];
    }
  | {
      REPORTED_ITEM_TYPE_KIND: 'THREAD';
      REPORTED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<ThreadSchemaFieldRoles>;
      REPORTED_ITEM_THREAD: null;
      REPORTED_ITEMS_IN_THREAD: null;
      ADDITIONAL_ITEMS: null;
    }
);

export type AppealSubmissionsRow = {
  TS: ColumnType<SfDate, Date, never>;
  ORG_ID: string;
  REQUEST_ID: string;
  APPEAL_ID: string;
  // user ID is nullable for the case where 'appealer type' is not 'user'
  // (meaning it wasn't manually added to the reporting queue by a user)
  APPEALED_BY_USER_ID: string | null;
  APPEALED_BY_USER_ITEM_TYPE_ID: string | null;
  APPEALED_AT: ColumnType<SfDate, Date, never>;
  APPEAL_REASON: string | null;
  ACTIONS_TAKEN: string[];
  ACTIONED_ITEM_ID: string;
  ACTIONED_ITEM_DATA: NormalizedItemData;
  ACTIONED_ITEM_TYPE_ID: string;
  ACTIONED_ITEM_TYPE_VERSION: ColumnType<string, string, never>;
  ACTIONED_ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant;
  ACTIONED_ITEM_TYPE_SCHEMA: ItemSchema;
  SKIP_JOB_ENQUEUE: boolean;
} & (
  | {
      ACTIONED_ITEM_TYPE_KIND: 'CONTENT';
      ACTIONED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<ContentSchemaFieldRoles>;
      ADDITIONAL_ITEMS: ItemSubmissionWithTypeIdentifier[];
    }
  | {
      ACTIONED_ITEM_TYPE_KIND: 'USER';
      ACTIONED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<UserSchemaFieldRoles>;
      ADDITIONAL_ITEMS: ItemSubmissionWithTypeIdentifier[];
    }
  | {
      ACTIONED_ITEM_TYPE_KIND: 'THREAD';
      ACTIONED_ITEM_TYPE_SCHEMA_FIELD_ROLES: Partial<ThreadSchemaFieldRoles>;
      ACTIONED_ITEMS_IN_THREAD: null;
      ADDITIONAL_ITEMS: null;
    }
);

export type ReportingRuleExecutionsRow = {
  RULE_NAME: string;
  RULE_ID: string;
  RULE_VERSION: string;
  RULE_ENVIRONMENT: RuleEnvironment;
  ORG_ID: string;
  CORRELATION_ID: string;
  RESULT: ConditionSetWithResultAsLogged;
  PASSED: boolean;
  TS: ColumnType<SfDate, number, never>;
  DS: ColumnType<FilterableSfDate, string, never>;
  POLICY_NAMES: readonly string[];
  POLICY_IDS: readonly string[];
  ITEM_ID: string;
  ITEM_TYPE_ID: string;
  ITEM_TYPE_KIND: ItemTypeKind;
  ITEM_TYPE_SCHEMA: JsonOf<ItemSchema>;
  ITEM_TYPE_SCHEMA_FIELD_ROLES: SchemaFieldRoles;
  ITEM_TYPE_VERSION: string;
  ITEM_TYPE_SCHEMA_VARIANT: ItemTypeSchemaVariant;
  ITEM_DATA: JsonOf<NormalizedItemData>;
  ITEM_TYPE_NAME: string;
  ITEM_CREATOR_ID: string | null;
  ITEM_CREATOR_TYPE_ID: string | null;
};

export type ReportingRuleExecutionStatisticsRow = {
  ORG_ID: string;
  RULE_ID: string;
  RULE_VERSION: SfDate;
  NUM_PASSES: number;
  NUM_RUNS: number;
  TS_START_INCLUSIVE: SfDate;
  TS_END_EXCLUSIVE: SfDate;
  RULE_ENVIRONMENT: string | null;
  RULE_POLICY_NAMES: string[] | null;
  RULE_POLICY_IDS: string[] | null;
};
export type ReportingServiceSnowflakeSchema = {
  'REPORTING_SERVICE.REPORTS': ReportSubmissionsRow;
  'REPORTING_SERVICE.APPEALS': AppealSubmissionsRow;
  'REPORTING_SERVICE.REPORTING_RULE_EXECUTIONS': ReportingRuleExecutionsRow;
  'REPORTING_SERVICE.REPORTING_RULE_EXECUTION_STATISTICS': ReportingRuleExecutionStatisticsRow;
};

export type ReportingServicePg = {
  'reporting_rules.reporting_rules': {
    id: string;
    org_id: string;
    name: string;
    description: string | null;
    status: ReportingRuleStatus;
    created_at: GeneratedAlways<Date>;
    creator_id: string;
    condition_set: ConditionSet;
  };

  'reporting_rules.reporting_rules_to_item_types': {
    item_type_id: string;
    reporting_rule_id: string;
    created_at: GeneratedAlways<Date>;
  };

  'reporting_rules.reporting_rules_to_actions': {
    action_id: string;
    reporting_rule_id: string;
    created_at: GeneratedAlways<Date>;
  };

  'reporting_rules.reporting_rules_to_policies': {
    policy_id: string;
    reporting_rule_id: string;
    created_at: GeneratedAlways<Date>;
  };

  'reporting_rules.reporting_rule_history': {
    id: string;
    org_id: string;
    name: string;
    description: string | null;
    status: ReportingRuleStatus;
    creator_id: string;
    condition_set: ConditionSet;
  };

  'reporting_rules.reporting_rule_versions': {
    id: GeneratedAlways<string>;
    name: GeneratedAlways<string>;
    org_id: GeneratedAlways<string>;
    description: GeneratedAlways<string | null>;
    status: GeneratedAlways<ReportingRuleStatus>;
    creator_id: GeneratedAlways<string>;
    condition_set: GeneratedAlways<ConditionSet>;
    is_current: GeneratedAlways<boolean>;
    version: GeneratedAlways<string>;
  };
};
