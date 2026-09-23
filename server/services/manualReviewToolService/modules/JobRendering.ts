import { type Kysely } from 'kysely';

import { makeNotFoundError } from '../../../utils/errors.js';
import { makeKyselyTransactionWithRetry } from '../../../utils/kyselyTransactionWithRetry.js';
import { type ModerationConfigServicePg } from '../../moderationConfigService/index.js';
import { assertHiddenFieldsExist } from '../../moderationConfigService/modules/itemTypeSchemaValidation.js';
import { type ManualReviewToolServicePg } from '../dbTypes.js';

type JobRenderingPg = ManualReviewToolServicePg & ModerationConfigServicePg;

export default class JobRendering {
  constructor(readonly pgQuery: Kysely<JobRenderingPg>) {}

  async getHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
  }) {
    const res = await this.pgQuery
      .selectFrom('manual_review_tool.manual_review_hidden_item_fields')
      .select(['hidden_fields'])
      .where('org_id', '=', opts.orgId)
      .where('item_type_id', '=', opts.itemTypeId)
      .executeTakeFirst();

    return res?.hidden_fields ?? [];
  }

  async setHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    hiddenFields: readonly string[];
  }) {
    const setHiddenFields = async (query: Kysely<JobRenderingPg>) => {
      const itemType = await query
        .selectFrom('public.item_types')
        .select('fields')
        .where('id', '=', opts.itemTypeId)
        .where('org_id', '=', opts.orgId)
        .forUpdate()
        .executeTakeFirst();
      if (itemType === undefined) {
        // The delete caller cleans up after deleting the item type.
        if (opts.hiddenFields.length === 0) {
          return query
            .$extendTables<ManualReviewToolServicePg>()
            .deleteFrom('manual_review_tool.manual_review_hidden_item_fields')
            .where('org_id', '=', opts.orgId)
            .where('item_type_id', '=', opts.itemTypeId)
            .execute();
        }
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      assertHiddenFieldsExist(itemType.fields, opts.hiddenFields);
      return query
        .$extendTables<ManualReviewToolServicePg>()
        .insertInto('manual_review_tool.manual_review_hidden_item_fields')
        .values({
          org_id: opts.orgId,
          item_type_id: opts.itemTypeId,
          hidden_fields: [...opts.hiddenFields],
        })
        .onConflict((oc) =>
          oc.columns(['org_id', 'item_type_id']).doUpdateSet({
            hidden_fields: [...opts.hiddenFields],
          }),
        )
        .execute();
    };

    return this.pgQuery.isTransaction
      ? setHiddenFields(this.pgQuery)
      : makeKyselyTransactionWithRetry(this.pgQuery)(setHiddenFields);
  }
}
