import { sql, type Kysely } from 'kysely';
import type { ItemIdentifier } from '@roostorg/types';

import {
  type ContentApiRequestRecord,
  type ContentApiRequestCountRecord,
  type ContentApiImageCountRecord,
  type ContentApiRequestQueryOptions,
  type IContentApiRequestsAdapter,
} from './IContentApiRequestsAdapter.js';
import { type SnowflakePublicSchema } from '../../../snowflake/types.js';
import { sfDateToDate, sfDateToDateOnlyString } from '../../../snowflake/types.js';
import { getUtcDateOnlyString } from '../../../utils/time.js';

interface ContentApiRow {
  ITEM_DATA: unknown;
  SUBMISSION_ID: string;
  TS: Date;
  ITEM_CREATOR_ID: string | null;
  ITEM_CREATOR_TYPE_ID: string | null;
  ITEM_TYPE_VERSION: string;
  ITEM_TYPE_SCHEMA_VARIANT: string;
}

export class SnowflakeContentApiRequestsAdapter
  implements IContentApiRequestsAdapter
{
  constructor(
    private readonly kysely: Kysely<
      Pick<SnowflakePublicSchema, 'CONTENT_API_REQUESTS'>
    >,
  ) {}

  async getSuccessfulRequestsForItem(
    orgId: string,
    item: ItemIdentifier,
    options?: ContentApiRequestQueryOptions,
  ): Promise<ReadonlyArray<ContentApiRequestRecord>> {
    const { latestOnly = false, lookbackWindowMs = 6 * 30 * 24 * 60 * 60 * 1000 } =
      options ?? {};

    const query = this.kysely
      .selectFrom('CONTENT_API_REQUESTS')
      .select([
        'ITEM_DATA',
        'SUBMISSION_ID',
        'TS',
        'ITEM_CREATOR_ID',
        'ITEM_CREATOR_TYPE_ID',
        'ITEM_TYPE_VERSION',
        'ITEM_TYPE_SCHEMA_VARIANT',
      ])
      .where('EVENT', '=', 'REQUEST_SUCCEEDED')
      .where('ORG_ID', '=', orgId)
      .where('ITEM_ID', '=', item.id)
      .where('ITEM_TYPE_ID', '=', item.typeId)
      .where(
        'DS',
        '>=',
        getUtcDateOnlyString(
          new Date(Date.now() - Math.max(1, lookbackWindowMs)),
        ),
      )
      .orderBy('TS', 'desc')
      .$if(latestOnly, (qb) => qb.limit(1));

    const rows = (await query.execute()) as unknown as ContentApiRow[];

    return rows.map<ContentApiRequestRecord>((row) => ({
      submissionId: row.SUBMISSION_ID,
      itemData: row.ITEM_DATA,
      itemTypeVersion: row.ITEM_TYPE_VERSION,
      itemTypeSchemaVariant: row.ITEM_TYPE_SCHEMA_VARIANT,
      itemCreatorId: row.ITEM_CREATOR_ID,
      itemCreatorTypeId: row.ITEM_CREATOR_TYPE_ID,
      occurredAt: sfDateToDate(row.TS),
    }));
  }

  async getSuccessfulRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiRequestCountRecord>> {
    const results = await this.kysely
      .selectFrom('CONTENT_API_REQUESTS')
      .select([sql<number>`COUNT(*)`.as('count'), 'DS'])
      .where('ORG_ID', '=', orgId)
      .where('EVENT', '=', 'REQUEST_SUCCEEDED')
      .where('DS', '>=', getUtcDateOnlyString(start))
      .where('DS', '<', getUtcDateOnlyString(end))
      .groupBy('DS')
      .execute();

    return results.map((row) => ({
      date: sfDateToDateOnlyString(row.DS),
      count: Number(row.count),
    }));
  }

  async getImageRequestCountsByDay(
    orgId: string,
    start: Date,
    end: Date,
  ): Promise<ReadonlyArray<ContentApiImageCountRecord>> {
    const query = sql<{
      DS: Date;
      COUNT: number;
    }>`SELECT ds, count(*) as count
FROM CONTENT_API_REQUESTS,
  LATERAL FLATTEN(input => parse_json(item_type_schema)) as f 
WHERE org_id = ${orgId}
  AND f.value:type::STRING = 'IMAGE'
  AND json_extract_path_text(item_data, CONCAT('"', f.value:name::STRING, '"')) IS NOT NULL
  AND ds >= ${getUtcDateOnlyString(start)}
  AND ds < ${getUtcDateOnlyString(end)}
GROUP BY ds
ORDER BY ds ASC`;

    const results = await query.execute(this.kysely);

    return results.rows.map((row) => ({
      date: sfDateToDateOnlyString(row.DS),
      count: Number(row.COUNT),
    }));
  }
}

