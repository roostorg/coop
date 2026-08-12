import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  getFieldValueForRole,
  type ItemSubmission,
  type NormalizedItemData,
  type RawItemData,
} from '../../services/itemProcessingService/index.js';
import { fromCorrelationId } from '../../utils/correlationIds.js';
import { jsonStringifyUnstable } from '../../utils/encoding.js';
import { getUtcDateOnlyString } from '../../utils/time.js';
import { type RuleExecutionCorrelationId } from './ruleExecutionLoggingUtils.js';

// NB: when an incoming POST /content api request fails, the content submission
// logged to the data warehouse might not be in a valid, processable shape (in fact, it
// may be that the content api request failed _because_ the content submission
// was invalid).
export type ContentApiRequestLogEntry<HasFailure extends boolean> = {
  requestId: RuleExecutionCorrelationId;
  orgId: string;
  itemSubmission: Pick<
    ItemSubmission,
    'submissionId' | 'creator' | 'itemId' | 'itemType' | 'submissionTime'
  > &
    (HasFailure extends false
      ? { data: NormalizedItemData }
      : { data: NormalizedItemData | RawItemData });
  failureReason: HasFailure extends true
    ? string
    : HasFailure extends false
      ? undefined
      : string | undefined;
};

export type ContentDetailsApiRequestLogEntry = {
  orgId: string;
  contentId: string;
  failureReason?: string;
};

class ContentApiLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
    private readonly dataWarehouse: Dependencies['DataWarehouse'],
    private readonly tracer: Dependencies['Tracer'],
  ) {}

  async logContentApiRequest<HasFailure extends boolean>(
    data: ContentApiRequestLogEntry<HasFailure>,
    skipBatch: boolean,
  ) {
    const { failureReason, itemSubmission } = data;
    const { itemType } = itemSubmission;
    const now = new Date();

    // Denormalize the IP address (if the item type maps an `ipAddress` field
    // role) into its own column so investigation can look up items by IP without
    // parsing `item_data` JSON at query time. Only attempt this for successful
    // requests, since failed requests may carry un-normalized item data.
    const rawIpAddress =
      failureReason == null
        ? getFieldValueForRole(
            itemType.schema,
            itemType.schemaFieldRoles,
            'ipAddress',
            itemSubmission.data as NormalizedItemData,
          )
        : undefined;
    const ipAddress =
      typeof rawIpAddress === 'string' ? rawIpAddress.trim() : undefined;

    await this.analytics.bulkWrite(
      'CONTENT_API_REQUESTS',
      [
        {
          ds: getUtcDateOnlyString(now),
          ts: now.valueOf(),
          item_id: itemSubmission.itemId,
          item_data: jsonStringifyUnstable(itemSubmission.data),
          item_ip_address: ipAddress ?? '',
          ...(itemSubmission.creator !== undefined
            ? {
                item_creator_id: itemSubmission.creator.id,
                item_creator_type_id: itemSubmission.creator.typeId,
              }
            : {}),
          item_type_kind: itemType.kind,
          item_type_name: itemType.name,
          item_type_version: itemType.version,
          item_type_schema_variant: itemType.schemaVariant,
          item_type_id: itemType.id,
          item_type_schema: jsonStringifyUnstable(itemType.schema),
          item_type_schema_field_roles: itemType.schemaFieldRoles,
          org_id: data.orgId,
          request_id: fromCorrelationId(data.requestId),
          submission_id: itemSubmission.submissionId,

          ...(failureReason != null
            ? {
                event: 'REQUEST_FAILED' as const,
                failure_reason: failureReason,
              }
            : { event: 'REQUEST_SUCCEEDED' as const }),
        },
      ],
      { batchTimeout: skipBatch ? 0 : undefined },
    );
  }

  async logContentDetailsApiRequest(data: ContentDetailsApiRequestLogEntry) {
    const { failureReason } = data;
    const now = new Date();
    await this.dataWarehouse.query(
      `INSERT INTO CONTENT_DETAILS_API_REQUESTS
        (ds, ts, content_id, org_id, event${
          failureReason ? ', failure_reason' : ''
        })
        VALUES (?, ?, ?, ?, ?${failureReason ? `, ?` : ''});`,
      this.tracer,
      [
        getUtcDateOnlyString(now),
        now.valueOf(),
        data.contentId,
        data.orgId,
        ...(failureReason != null
          ? ['REQUEST_FAILED', failureReason]
          : ['REQUEST_SUCCEEDED']),
      ],
    );
  }
}

export default inject(
  ['DataWarehouseAnalytics', 'DataWarehouse', 'Tracer'],
  ContentApiLogger,
);
export { type ContentApiLogger };
