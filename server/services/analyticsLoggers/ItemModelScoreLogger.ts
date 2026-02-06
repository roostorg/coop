import { type Dependencies } from '../../iocContainer/index.js';
import { inject } from '../../iocContainer/utils.js';
import {
  type ItemSubmission,
  type NormalizedItemData,
  type RawItemData,
} from '../../services/itemProcessingService/index.js';
import { jsonStringifyUnstable } from '../../utils/encoding.js';
import { getUtcDateOnlyString } from '../../utils/time.js';

// NB: when an incoming POST /items/scores api request fails, the content submission
// logged to snowflake might not be in a valid, processable shape (in fact, it
// may be that the content api request failed _because_ the content submission
// was invalid).
export type ItemModelScoreLogEntry<HasFailure extends boolean> = {
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
  model: HasFailure extends true
    ? undefined
    : {
        id: string;
        version: number;
        score?: number;
      };
};

class ItemModelScoreLogger {
  constructor(
    private readonly analytics: Dependencies['DataWarehouseAnalytics'],
  ) {}

  async logItemModelScore<HasFailure extends boolean>(
    data: ItemModelScoreLogEntry<HasFailure>,
    skipBatch: boolean,
  ) {
    const { failureReason, itemSubmission } = data;
    const { itemType } = itemSubmission;
    const now = new Date();
    await this.analytics.bulkWrite(
      'ITEM_MODEL_SCORES_LOG',
      [
        {
          ds: getUtcDateOnlyString(now),
          ts: now.valueOf(),
          item_id: itemSubmission.itemId,
          item_data: jsonStringifyUnstable(itemSubmission.data),
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
          submission_id: itemSubmission.submissionId,
          ...(data.model
            ? {
                model_id: data.model.id,
                model_version: data.model.version,
                model_score: data.model.score,
              }
            : {}),
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
}

export default inject(['DataWarehouseAnalytics'], ItemModelScoreLogger);
export { type ItemModelScoreLogger };
