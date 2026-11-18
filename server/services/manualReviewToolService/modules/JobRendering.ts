import {
  managerOf,
  transactionWithRetry,
  type TypeormDb,
} from '../../../storage/typeorm/db.js';
import {
  ItemTypes,
  ManualReviewHiddenItemFields,
} from '../../../storage/typeorm/entities/index.js';
import { makeNotFoundError } from '../../../utils/errors.js';
import { assertHiddenFieldsExist } from '../../moderationConfigService/modules/itemTypeSchemaValidation.js';
import { type ItemSchema } from '../../moderationConfigService/types/itemTypes.js';

export default class JobRendering {
  constructor(readonly db: TypeormDb) {}

  async getHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
  }) {
    const manager = await managerOf(this.db);
    const res = await manager.findOne(ManualReviewHiddenItemFields, {
      select: { hidden_fields: true },
      where: { org_id: opts.orgId, item_type_id: opts.itemTypeId },
    });
    return res?.hidden_fields ?? [];
  }

  async setHiddenFieldsForItemType(opts: {
    orgId: string;
    itemTypeId: string;
    hiddenFields: readonly string[];
  }) {
    return transactionWithRetry(this.db, {}, async (manager) => {
      if (opts.hiddenFields.length === 0) {
        await manager.delete(ManualReviewHiddenItemFields, {
          org_id: opts.orgId,
          item_type_id: opts.itemTypeId,
        });
        return;
      }

      const itemType = await manager
        .createQueryBuilder(ItemTypes, 'it')
        .select('it.fields', 'fields')
        .where('it.id = :id AND it.org_id = :orgId', {
          id: opts.itemTypeId,
          orgId: opts.orgId,
        })
        .setLock('pessimistic_write')
        .getRawOne<{ fields: ItemSchema }>();
      if (itemType === undefined) {
        throw makeNotFoundError('Item type not found', {
          shouldErrorSpan: false,
        });
      }
      assertHiddenFieldsExist(itemType.fields, opts.hiddenFields);
      await manager.upsert(
        ManualReviewHiddenItemFields,
        {
          org_id: opts.orgId,
          item_type_id: opts.itemTypeId,
          hidden_fields: [...opts.hiddenFields],
        },
        ['org_id', 'item_type_id'],
      );
    });
  }
}
