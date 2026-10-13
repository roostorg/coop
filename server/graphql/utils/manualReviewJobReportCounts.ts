import DataLoader from 'dataloader';

import { type Context } from '../resolvers.js';

const reportCountLoaders = new WeakMap<Context, DataLoader<string, number>>();

export function getManualReviewJobReportCountLoader(context: Context) {
  const existing = reportCountLoaders.get(context);
  if (existing != null) {
    return existing;
  }

  const user = context.getUser();
  if (user == null) {
    throw new Error('No user found on context');
  }

  const loader = new DataLoader<string, number>(
    async (itemIds) => {
      const counts =
        await context.services.ReportingService.getNumTimesReportedForItems({
          orgId: user.orgId,
          itemIds: [...new Set(itemIds)],
        });
      return itemIds.map((itemId) => counts.get(itemId) ?? 0);
    },
    { cache: false },
  );
  reportCountLoaders.set(context, loader);
  return loader;
}
