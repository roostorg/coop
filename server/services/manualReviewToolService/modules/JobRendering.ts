import {
  type PrismaPgQueryable,
  type PrismaPgTransaction,
} from '../../../storage/prisma/index.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { type ItemSchema } from '../../moderationConfigService/index.js';
import { assertHiddenFieldsExist } from '../../moderationConfigService/modules/itemTypeSchemaValidation.js';
import { runInPrismaTransaction } from '../../moderationConfigService/prismaTransaction.js';

export default class JobRendering {
  constructor(readonly pgQuery: PrismaPgQueryable) {}

  async getHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
  }) {
    const res = await this.pgQuery.manual_review_hidden_item_fields.findUnique({
      select: { hidden_fields: true },
      where: {
        org_id_item_type_id: {
          org_id: opts.orgId,
          item_type_id: opts.itemTypeId,
        },
      },
    });

    return res?.hidden_fields ?? [];
  }

  async setHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    hiddenFields: readonly string[];
  }) {
    const setHiddenFields = async (query: PrismaPgTransaction) => {
      if (opts.hiddenFields.length === 0) {
        return query.manual_review_hidden_item_fields.deleteMany({
          where: { org_id: opts.orgId, item_type_id: opts.itemTypeId },
        });
      }

      // prisma-raw: FOR UPDATE
      const itemType = (
        await query.$queryRaw<{ fields: ItemSchema }[]>`
        SELECT fields
        FROM public.item_types
        WHERE id = ${opts.itemTypeId} AND org_id = ${opts.orgId}
        FOR UPDATE`
      ).at(0);
      if (itemType === undefined) {
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      assertHiddenFieldsExist(itemType.fields, opts.hiddenFields);
      return query.manual_review_hidden_item_fields.upsert({
        where: {
          org_id_item_type_id: {
            org_id: opts.orgId,
            item_type_id: opts.itemTypeId,
          },
        },
        create: {
          org_id: opts.orgId,
          item_type_id: opts.itemTypeId,
          hidden_fields: [...opts.hiddenFields],
        },
        update: { hidden_fields: [...opts.hiddenFields] },
      });
    };

    await runInPrismaTransaction(this.pgQuery, {}, setHiddenFields);
  }
}
