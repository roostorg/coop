import { and, eq, is } from 'drizzle-orm';
import { PgAsyncTransaction } from 'drizzle-orm/pg-core';

import {
  schema,
  transactionWithRetry,
  type CoopDbOrTx,
} from '../../../storage/postgres/drizzle.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { type ItemSchema } from '../../moderationConfigService/index.js';
import { assertHiddenFieldsExist } from '../../moderationConfigService/modules/itemTypeSchemaValidation.js';

const { manualReviewHiddenItemFields: hiddenItemFields, itemTypes } = schema;

export default class JobRendering {
  constructor(readonly db: CoopDbOrTx) {}

  async getHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
  }) {
    const res = (
      await this.db
        .select({ hiddenFields: hiddenItemFields.hiddenFields })
        .from(hiddenItemFields)
        .where(
          and(
            eq(hiddenItemFields.orgId, opts.orgId),
            eq(hiddenItemFields.itemTypeId, opts.itemTypeId),
          ),
        )
        .limit(1)
    ).at(0);

    return res?.hiddenFields ?? [];
  }

  async setHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    hiddenFields: readonly string[];
  }) {
    const setHiddenFields = async (query: CoopDbOrTx) => {
      if (opts.hiddenFields.length === 0) {
        return query
          .delete(hiddenItemFields)
          .where(
            and(
              eq(hiddenItemFields.orgId, opts.orgId),
              eq(hiddenItemFields.itemTypeId, opts.itemTypeId),
            ),
          );
      }

      const itemType = (
        await query
          .select({ fields: itemTypes.fields })
          .from(itemTypes)
          .where(
            and(
              eq(itemTypes.id, opts.itemTypeId),
              eq(itemTypes.orgId, opts.orgId),
            ),
          )
          .limit(1)
          .for('update')
      ).at(0);
      if (itemType === undefined) {
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      assertHiddenFieldsExist(
        itemType.fields as unknown as ItemSchema,
        opts.hiddenFields,
      );
      return query
        .insert(hiddenItemFields)
        .values({
          orgId: opts.orgId,
          itemTypeId: opts.itemTypeId,
          hiddenFields: [...opts.hiddenFields],
        })
        .onConflictDoUpdate({
          target: [hiddenItemFields.orgId, hiddenItemFields.itemTypeId],
          set: { hiddenFields: [...opts.hiddenFields] },
        });
    };

    // Join the caller's transaction when given one (see
    // ManualReviewToolService.forTransaction); otherwise open our own so the
    // item type row lock covers the upsert.
    return is(this.db, PgAsyncTransaction)
      ? setHiddenFields(this.db)
      : transactionWithRetry(this.db, setHiddenFields);
  }
}
