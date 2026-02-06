import { type Kysely } from 'kysely';

import { type ManualReviewToolServicePg } from '../dbTypes.js';

export default class JobRendering {
  constructor(readonly pgQuery: Kysely<ManualReviewToolServicePg>) {}

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
    return this.pgQuery
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
  }
}
