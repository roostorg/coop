import { inject } from '../../iocContainer/index.js';
import { type ItemTypeSelector } from './types/itemTypes.js';

export const makeGetItemTypeEventuallyConsistent = inject(
  ['ModerationConfigService'],
  (moderationConfigService) =>
    async (opts: { orgId: string; typeSelector: ItemTypeSelector }) =>
      moderationConfigService.getItemType({
        orgId: opts.orgId,
        itemTypeSelector: opts.typeSelector,
      }),
);

export type GetItemTypeEventuallyConsistent = ReturnType<
  typeof makeGetItemTypeEventuallyConsistent
>;
