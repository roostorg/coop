/**
 * Extended interface for data warehouse analytics features
 * Allows integrators to implement CDC, bulk writes, and logging for any warehouse
 */

import type SafeTracer from '../../utils/SafeTracer.js';

/**
 * Schema definition that integrators must implement
 * Each warehouse implementation creates their own tables/schemas matching these types
 */
export type AnalyticsSchema = {
  RULE_EXECUTIONS: {
    ds: string;
    ts: number;
    org_id: string;
    item_id: string;
    item_type_id: string;
    item_type_kind: string;
    item_submission_id?: string;
    item_data?: string;
    item_type_name?: string;
    item_creator_id?: string;
    item_creator_type_id?: string;
    item_type_schema?: string;
    item_type_schema_field_roles?: Record<string, string>;
    item_type_schema_variant?: string;
    item_type_version?: string;
    rule: string;
    rule_id: string;
    rule_version: string;
    tags: readonly string[];
    policy_ids: readonly string[];
    policy_names: readonly string[];
    environment: string;
    correlation_id: string;
    result: string;
    passed: boolean;
  };

  ACTION_EXECUTIONS: {
    ds: string;
    ts: number;
    org_id: string;
    action_id: string;
    action_name: string;
    action_source: string;
    correlation_id: string;
    item_id: string;
    item_type_id: string;
    item_type_kind: string;
    item_submission_id?: string;
    item_creator_id?: string;
    item_creator_type_id?: string;
    rule_environment?: string;
    rules?: readonly unknown[];
    rule_tags?: readonly string[];
    policies: readonly unknown[];
    actor_id?: string;
    job_id?: string;
    failed: boolean;
  };

  ITEM_MODEL_SCORES_LOG: {
    ds: string;
    ts: number;
    org_id: string;
    item_id: string;
    item_data: string;
    item_type_id: string;
    item_type_kind: string;
    item_type_name: string;
    item_type_version: string;
    item_type_schema_variant: string;
    item_type_schema: string;
    item_type_schema_field_roles?: Record<string, unknown>;
    item_submission_id?: string;
    item_creator_id?: string;
    item_creator_type_id?: string;
    submission_id?: string;
    model_id?: string;
    model_version?: number | string;
    model_score?: number;
    event: string;
    failure_reason?: string;
    metadata?: Record<string, unknown>;
    correlation_id?: string;
    failed?: boolean;
    error_message?: string;
  };

  CONTENT_API_REQUESTS: {
    ds: string;
    ts: number;
    org_id: string;
    item_id: string;
    item_type_id: string;
    item_submission_id?: string;
    item_creator_id?: string;
    endpoint: string;
    method: string;
    correlation_id: string;
    duration_ms: number;
    failed: boolean;
    error_message?: string;
  };

  // Operational tables (using warehouse for operational data)
  'REPORTING_SERVICE.REPORTS': {
    [key: string]: unknown; // Dynamic schema
  };
  
  'REPORTING_SERVICE.APPEALS': {
    [key: string]: unknown; // Dynamic schema
  };
  
  'USER_STATISTICS_SERVICE.USER_SCORES': {
    [key: string]: unknown; // Dynamic schema
  };
  
  'USER_STATISTICS_SERVICE.SUBMISSION_STATS': {
    [key: string]: unknown; // Dynamic schema
  };
};

/**
 * Configuration for bulk/eventual writes
 */
export interface BulkWriteConfig {
  batchSize?: number;
  batchTimeout?: number;
  compression?: boolean;
}

/**
 * CDC/Streaming configuration
 */
export interface CDCConfig<TableName extends string> {
  tableName: TableName;
  schemaName?: string;
  batchSize?: number;
  pollInterval?: number;
}

/**
 * CDC change record
 */
export interface CDCChange<T = unknown> {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  before?: T;
  after?: T;
  metadata: {
    timestamp: Date;
    transactionId?: string;
  };
}

/**
 * Extended interface for analytics-specific warehouse features
 * Implementations provide CDC, bulk writes, and other analytics capabilities
 */
export interface IDataWarehouseAnalytics {
  /**
   * Bulk write rows to a table with batching/buffering
   * Implementations handle batching, compression, and optimal ingestion
   */
  bulkWrite<TableName extends keyof AnalyticsSchema>(
    tableName: TableName,
    rows: readonly AnalyticsSchema[TableName][],
    config?: BulkWriteConfig,
  ): Promise<void>;

  /**
   * Create a CDC stream/listener on a table
   * Implementations use their warehouse's CDC mechanism (Snowflake Streams, 
   * Clickhouse materialized views, PostgreSQL logical replication, etc.)
   */
  createCDCStream<TableName extends string>(
    config: CDCConfig<TableName>,
  ): Promise<void>;

  /**
   * Consume changes from a CDC stream
   * Callback is called with batches of changes
   */
  consumeCDCChanges<T = unknown>(
    streamName: string,
    callback: (changes: CDCChange<T>[]) => Promise<void>,
    tracer: SafeTracer,
  ): Promise<void>;

  /**
   * Check if CDC is supported by this warehouse
   */
  supportsCDC(): boolean;

  /**
   * Flush any pending bulk writes
   * Called during shutdown to ensure all data is written
   */
  flushPendingWrites(): Promise<void>;

  /**
   * Close/cleanup the analytics adapter
   * Alias for flushPendingWrites for IOC container compatibility
   */
  close?(): Promise<void>;
}

/**
 * Schema documentation for integrators
 * Describes what tables/schemas need to be created in the warehouse
 */
export const ANALYTICS_SCHEMA_DOCS = {
  RULE_EXECUTIONS: {
    description: 'Logs every rule execution against content',
    partitionKey: 'ds',
    sortKey: 'ts',
    indexes: ['org_id', 'rule_id', 'item_id'],
  },
  ACTION_EXECUTIONS: {
    description: 'Logs every action execution (moderation actions taken)',
    partitionKey: 'ds', 
    sortKey: 'ts',
    indexes: ['org_id', 'action_id', 'item_id'],
  },
  ITEM_MODEL_SCORES_LOG: {
    description: 'Logs ML model scores for content',
    partitionKey: 'ds',
    sortKey: 'ts',
    indexes: ['org_id', 'model_id', 'item_id'],
  },
  CONTENT_API_REQUESTS: {
    description: 'Logs API requests for content moderation',
    partitionKey: 'ds',
    sortKey: 'ts',
    indexes: ['org_id', 'endpoint'],
  },
} as const;

/**
 * Example migration documentation for integrators
 */
export const MIGRATION_EXAMPLE = `
-- Example for PostgreSQL:
CREATE TABLE rule_executions (
  ds DATE NOT NULL,
  ts BIGINT NOT NULL,
  org_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  -- ... other fields from AnalyticsSchema
  PRIMARY KEY (ds, ts, org_id, item_id)
);

CREATE INDEX idx_rule_executions_org ON rule_executions(org_id);
CREATE INDEX idx_rule_executions_rule ON rule_executions(rule_id);

-- Example for Clickhouse:
CREATE TABLE rule_executions (
  ds Date,
  ts UInt64,
  org_id String,
  item_id String,
  rule_id String,
  passed UInt8,
  -- ... other fields
) ENGINE = MergeTree()
PARTITION BY ds
ORDER BY (ds, ts, org_id);

-- Example for Snowflake:
CREATE TABLE rule_executions (
  ds DATE NOT NULL,
  ts NUMBER NOT NULL,
  org_id VARCHAR NOT NULL,
  item_id VARCHAR NOT NULL,
  rule_id VARCHAR NOT NULL,
  passed BOOLEAN NOT NULL,
  -- ... other fields
) PARTITION BY (ds);
`;

