import type { ItemIdentifier } from '@roostorg/types';

import {
  type ContentApiRequestRecord,
  type ContentApiRequestCountRecord,
  type ContentApiImageCountRecord,
  type ContentApiRequestQueryOptions,
  type IContentApiRequestsAdapter,
} from './IContentApiRequestsAdapter.js';
import type { IDataWarehouse } from '../../../storage/dataWarehouse/IDataWarehouse.js';
import type SafeTracer from '../../../utils/SafeTracer.js';
import { formatClickhouseQuery } from '../utils/clickhouseSql.js';

interface ClickhouseContentApiRow {
  item_data: unknown;
  submission_id: string;
  ts: string;
  item_creator_id: string | null;
  item_creator_type_id: string | null;
  item_type_version: string;
  item_type_schema_variant: string;
}

interface CountRow {
  date: string;
  count: number;
}

export class ClickhouseContentApiRequestsAdapter
  implements IContentApiRequestsAdapter
{
  constructor(
    private readonly warehouse: IDataWarehouse,
    private readonly tracer: SafeTracer,
  ) {}

  async getSuccessfulRequestsForItem(
    orgId: string,
    item: ItemIdentifier,
    options?: ContentApiRequestQueryOptions,
  ): Promise<ReadonlyArray<ContentApiRequestRecord>> {
    const { latestOnly = false, lookbackWindowMs = 6 * 30 * 24 * 60 * 60 * 1000 } =
      options ?? {};

    const lookbackStart = new Date(
      Date.now() - Math.max(1, lookbackWindowMs),
    );
    const lookbackStartDate = lookbackStart.toISOString().slice(0, 10);

    const conditions = [
      'org_id = ?',
      "event = 'REQUEST_SUCCEEDED'",
      'item_id = ?',
      'item_type_id = ?',
      'ds >= toDate(?)',
    ];

    const params: unknown[] = [
      orgId,
      item.id,
      item.typeId,
      lookbackStartDate,
    ];

    const sql = `
      SELECT
        item_data,
        submission_id,
        ts,
        item_creator_id,
        item_creator_type_id,
        item_type_version,
        item_type_schema_variant
      FROM analytics.CONTENT_API_REQUESTS
      WHERE ${conditions.join(' AND ')}
      ORDER BY ts DESC
      ${latestOnly ? 'LIMIT 1' : ''}
    `;

    const rows = (await this.query(sql, params)) as ClickhouseContentApiRow[];

    return rows.map<ContentApiRequestRecord>((row) => ({
      submissionId: row.submission_id,
      itemData: row.item_data,
      itemTypeVersion: row.item_type_version,
      itemTypeSchemaVariant: row.item_type_schema_variant,
      itemCreatorId: row.item_creator_id,
      itemCreatorTypeId: row.item_creator_type_id,
      occurredAt: new Date(row.ts),
    }));
  }

  async getSuccessfulRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiRequestCountRecord>> {
    const sql = `
      SELECT
        ds AS date,
        count() AS count
      FROM analytics.CONTENT_API_REQUESTS
      WHERE org_id = ?
        AND event = 'REQUEST_SUCCEEDED'
        AND ds >= toDate(?)
        AND ds < toDate(?)
      GROUP BY date
      ORDER BY date
    `;

    const rows = (await this.query(sql, [
      orgId,
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    ])) as CountRow[];

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  async getImageRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiImageCountRecord>> {
    const sql = `
      SELECT
        ds AS date,
        countIf(
          JSONExtractString(item_type_schema, concat('$.', key, '.type')) = 'IMAGE'
          AND JSONExtractRaw(item_data, concat('$.', key)) IS NOT NULL
        ) AS count
      FROM analytics.CONTENT_API_REQUESTS
      ARRAY JOIN JSONExtractKeys(item_type_schema) AS key
      WHERE org_id = ?
        AND event = 'REQUEST_SUCCEEDED'
        AND ds >= toDate(?)
        AND ds < toDate(?)
      GROUP BY date
      ORDER BY date
    `;

    const rows = (await this.query(sql, [
      orgId,
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    ])) as CountRow[];

    return rows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  private async query<T>(
    statement: string,
    params: readonly unknown[],
  ): Promise<readonly T[]> {
    const formatted = formatClickhouseQuery(statement, params);
    const result = await this.warehouse.query(
      formatted,
      this.tracer,
    );
    return result as readonly T[];
  }
}

