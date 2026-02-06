import { createClient, type ClickHouseClient } from '@clickhouse/client';

import type SafeTracer from '../../../utils/SafeTracer.js';
import { jsonStringify, tryJsonParse } from '../../../utils/encoding.js';
import type { IAnalyticsAdapter } from '../IAnalyticsAdapter.js';
import {
  type AnalyticsEventInput,
  type AnalyticsQueryResult,
  type AnalyticsWriteOptions,
} from '../types.js';
import { formatClickhouseQuery } from '../../warehouse/utils/clickhouseSql.js';

export interface ClickhouseAnalyticsConnection {
  host: string;
  username: string;
  password: string;
  database: string;
  port?: number;
  protocol?: 'http' | 'https';
}

export interface ClickhouseAnalyticsAdapterOptions {
  connection: ClickhouseAnalyticsConnection;
  tracer?: SafeTracer;
  defaultBatchSize?: number;
}

export class ClickhouseAnalyticsAdapter implements IAnalyticsAdapter {
  private static readonly JSON_OBJECT_FIELDS_BY_TABLE = new Map<
    string,
    ReadonlySet<string>
  >([
    [
      'content_api_requests',
      new Set(['item_type_schema_field_roles']),
    ],
    [
      'item_model_scores_log',
      new Set(['item_type_schema_field_roles']),
    ],
    [
      'appeals',
      new Set(['actioned_item_type_schema_field_roles']),
    ],
    [
      'reporting_rule_executions',
      new Set(['result', 'item_type_schema_field_roles']),
    ],
    [
      'reports',
      new Set(['reported_item_data', 'reported_item_type_schema_field_roles']),
    ],
  ]);

  private static readonly JSON_ARRAY_FIELDS_BY_TABLE = new Map<
    string,
    ReadonlySet<string>
  >([
    [
      'action_executions',
      new Set(['rules', 'policies', 'rule_tags']),
    ],
    [
      'reporting_rule_executions',
      new Set([]),
    ],
    [
      'reports',
      new Set([]),
    ],
  ]);

  private static readonly DATE_TIME_FIELDS = new Set([
    'rule_version',
    'prior_rule_version',
  ]);

  private static readonly DATE_FIELD_KINDS = new Map<string, DateFieldKind>([
    ['ts', 'datetime'],
    ['ds', 'date'],
    ['rule_version', 'datetime'],
    ['prior_rule_version', 'datetime'],
    ['ts_start_inclusive', 'datetime'],
    ['ts_end_exclusive', 'datetime'],
    ['reported_at', 'datetime'],
    ['appealed_at', 'datetime'],
    ['created_at', 'datetime'],
    ['updated_at', 'datetime'],
    ['action_time', 'datetime'],
  ]);

  readonly name = 'clickhouse-analytics';

  private readonly tracer?: SafeTracer;
  private readonly client: ClickHouseClient;
  private readonly defaultBatchSize: number;

  constructor(options: ClickhouseAnalyticsAdapterOptions) {
    this.tracer = options.tracer;
    this.defaultBatchSize = options.defaultBatchSize ?? 500;

    const protocol = options.connection.protocol ?? 'http';
    const port = options.connection.port ?? 8123;

    const url = `${protocol}://${options.connection.host}:${port}`;
    const password = options.connection.password.length
      ? options.connection.password
      : undefined;
    this.client = createClient({
      url,
      username: options.connection.username,
      ...(password ? { password } : {}),
      database: options.connection.database,
    });
  }

  async writeEvents(
    table: string,
    events: readonly AnalyticsEventInput[],
    _options?: AnalyticsWriteOptions,
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const batches = this.partition(events, this.defaultBatchSize);

    for (const batch of batches) {
      const normalizedBatch = batch.map((row) =>
        this.normalizeRecord(row, table),
      );

      await this.client.insert({
        table,
        values: normalizedBatch,
        format: 'JSONEachRow',
      });
    }
  }

  async query<T = AnalyticsQueryResult>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const execute = async () => {
      const statement = formatClickhouseQuery(sql, params);
      const result = await this.client.query({
        query: statement,
        format: 'JSONEachRow',
      });

      const rows = (await result.json());
      return rows as readonly T[];
    };

    if (this.tracer) {
      return this.tracer.addActiveSpan(
        { resource: 'clickhouse.client', operation: 'clickhouse.query' },
        execute,
      );
    }

    return execute();
  }

  async flush(): Promise<void> {
    // No-op: inserts are executed eagerly.
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private partition<T>(values: readonly T[], size: number): T[][] {
    if (values.length <= size) {
      return [values.slice()];
    }

    const batches: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      batches.push(values.slice(index, index + size));
    }

    return batches;
  }

  private normalizeRecord(
    record: AnalyticsEventInput,
    table: string,
  ): AnalyticsEventInput {
    const normalized: AnalyticsEventInput = {};
    const tableKey = ClickhouseAnalyticsAdapter.normalizeTableName(table);
    const jsonObjectFields =
      ClickhouseAnalyticsAdapter.JSON_OBJECT_FIELDS_BY_TABLE.get(tableKey);
    const jsonArrayFields =
      ClickhouseAnalyticsAdapter.JSON_ARRAY_FIELDS_BY_TABLE.get(tableKey);

    for (const [key, value] of Object.entries(record)) {
      // ClickHouse doesn't support nullable arrays, so convert null to empty array
      // policy_names, policy_ids, tags are regular Array(String) columns
      // rules, policies, rule_tags are String columns storing JSON
      const regularArrayFields = ['policy_names', 'policy_ids', 'tags'];
      const jsonStringFields = ['rules', 'policies', 'rule_tags'];
      
      if (regularArrayFields.includes(key) && (value === null || value === undefined)) {
        normalized[key] = [];
        continue;
      }
      
      if (jsonStringFields.includes(key) && (value === null || value === undefined)) {
        normalized[key] = '[]';
        continue;
      }

      normalized[key] = this.normalizeFieldValue({
        key,
        value,
        jsonArrayFields,
        jsonObjectFields,
      });
    }

    // Stringify JSON fields (stored as String in ClickHouse)
    this.stringifyJsonFields(normalized, jsonObjectFields, '{}');
    this.stringifyJsonFields(normalized, jsonArrayFields, '[]');

    return normalized;
  }

  private stringifyJsonFields(
    normalized: AnalyticsEventInput,
    fields: ReadonlySet<string> | undefined,
    defaultValue: string,
  ): void {
    if (!fields) {
      return;
    }

    for (const fieldKey of fields) {
      if (!(fieldKey in normalized)) {
        normalized[fieldKey] = defaultValue;
      } else {
        const value = normalized[fieldKey];
        if (typeof value === 'string') {
          // Already a string, keep it
          continue;
        }
        if (value !== null && (typeof value === 'object' || Array.isArray(value))) {
          normalized[fieldKey] = jsonStringify(value);
        } else {
          normalized[fieldKey] = defaultValue;
        }
      }
    }
  }

  private normalizeJsonObject(value: unknown): unknown {
    if (value == null) {
      return {};
    }

    if (typeof value === 'string') {
      return tryJsonParse(value) ?? {};
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'object') {
      return value;
    }

    return {};
  }

  private normalizeJsonArray(value: unknown): unknown[] {
    if (value == null) {
      return [];
    }

    let candidate: unknown;

    if (Array.isArray(value)) {
      candidate = value;
    } else if (typeof value === 'string') {
      candidate = tryJsonParse(value);
      if (candidate == null) {
        return [];
      }
    } else {
      candidate = tryJsonParse(jsonStringify(value));
      if (candidate == null) {
        return [];
      }
    }

    if (!Array.isArray(candidate)) {
      return [];
    }

    return candidate.map((entry) => {
      if (entry == null) {
        return entry;
      }
      if (Array.isArray(entry)) {
        return this.normalizeJsonArray(entry);
      }
      if (typeof entry === 'object') {
        return entry;
      }
      return entry;
    });
  }

  private normalizeFieldValue(params: {
    key: string;
    value: unknown;
    jsonArrayFields?: ReadonlySet<string>;
    jsonObjectFields?: ReadonlySet<string>;
  }): unknown {
    const { key, value, jsonArrayFields, jsonObjectFields } = params;
    const lowerKey = key.toLowerCase();

    if (jsonArrayFields?.has(key)) {
      return this.normalizeJsonArray(value);
    }

    const dateKind =
      ClickhouseAnalyticsAdapter.DATE_FIELD_KINDS.get(lowerKey);
    if (dateKind) {
      return this.normalizeDateField(value, dateKind);
    }

    if (jsonObjectFields?.has(key)) {
      return this.normalizeJsonObject(value);
    }

    // Some JSON/complex fields are stored as String in ClickHouse because:
    // 1. ClickHouse doesn't support Nullable(JSON/Object)
    // 2. ClickHouse JSON type doesn't handle arrays of objects well
    const stringifyFields = [
      'reported_item_thread', // REPORTING_SERVICE.REPORTS - nullable array
      'reported_items_in_thread', // REPORTING_SERVICE.REPORTS - nullable array
      'reported_item_type_schema', // REPORTING_SERVICE.REPORTS - array of objects
      'item_type_schema', // various tables - array of objects
      'actioned_item_type_schema', // REPORTING_SERVICE.APPEALS - array of objects
      'additional_items', // REPORTING_SERVICE.REPORTS/APPEALS - array of objects
    ];

    if (stringifyFields.includes(key) && value != null) {
      if (typeof value === 'string') {
        return value; // Already stringified
      }
      return jsonStringify(value);
    }

    // For ClickHouse JSON columns with experimental object type enabled,
    // we should pass objects/arrays directly. The ClickHouse client will
    // handle serialization when using JSONEachRow format.
    
    if (Array.isArray(value)) {
      if (stringifyFields.includes(key)) {
        return jsonStringify(value);
      }
      return value.map((item) => this.normalizeValue(item));
    }

    if (value && typeof value === 'object') {
      const normalizedEntries = Object.entries(
        value as Record<string, unknown>,
      ).map(([entryKey, entryValue]) => [
        entryKey,
        this.normalizeValue(entryValue, entryKey),
      ]);
      return Object.fromEntries(normalizedEntries);
    }

    return value;
  }

  private normalizeDateField(
    value: unknown,
    kind: DateFieldKind,
  ): unknown {
    if (value == null) {
      return value;
    }

    let date: Date | undefined;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.length) {
        return value;
      }
      const maybeNumber = Number(trimmed);
      // eslint-disable-next-line security/detect-unsafe-regex
      if (!Number.isNaN(maybeNumber) && /^[+-]?\d+(\.\d+)?$/u.test(trimmed)) {
        // Interpret numeric strings as epoch milliseconds (or seconds if clearly seconds)
        date = new Date(
          trimmed.includes('.') ? maybeNumber * 1000 : maybeNumber,
        );
      } else {
        date = new Date(trimmed);
      }
    }

    if (!date || Number.isNaN(date.getTime())) {
      return value;
    }

    return this.formatDate(date, kind);
  }

  private normalizeValue(value: unknown, key?: string): unknown {
    // Used for recursion on nested values that aren't top-level fields.
    if (key) {
      return this.normalizeFieldValue({
        key,
        value,
      });
    }
    return value;
  }

  private parseAndFormatDate(value: string, column: string): string | undefined {
    const kind =
      ClickhouseAnalyticsAdapter.DATE_FIELD_KINDS.get(column.toLowerCase());
    if (!kind) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return this.formatDate(parsed, kind);
  }

  private formatDate(date: Date, kind: DateFieldKind): string {
    if (kind === 'date') {
      return date.toISOString().slice(0, 10);
    }

    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  private static normalizeTableName(table: string): string {
    const lower = table.toLowerCase();
    const dotIndex = lower.lastIndexOf('.');
    return dotIndex >= 0 ? lower.slice(dotIndex + 1) : lower;
  }
}

type DateFieldKind = 'datetime' | 'date';
