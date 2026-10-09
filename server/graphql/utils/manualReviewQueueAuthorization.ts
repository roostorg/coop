import DataLoader from 'dataloader';

import { type Context } from '../resolvers.js';
import { forbiddenError, unauthenticatedError } from './errors.js';

const queueReviewabilityLoaders = new WeakMap<
  Context,
  DataLoader<string, boolean>
>();

function getQueueReviewabilityLoader(context: Context) {
  const existing = queueReviewabilityLoaders.get(context);
  if (existing != null) {
    return existing;
  }

  const user = context.getUser();
  if (user == null) {
    throw unauthenticatedError('User required.');
  }

  const loader = new DataLoader<string, boolean>(
    async (queueIds) => {
      const uniqueQueueIds = [...new Set(queueIds)];
      const reviewableQueues =
        await context.services.ManualReviewToolService.getReviewableQueuesForUser(
          {
            invoker: {
              userId: user.id,
              permissions: user.getPermissions(),
              orgId: user.orgId,
            },
            queueIds: uniqueQueueIds,
          },
        );
      const reviewableQueueIds = new Set(
        reviewableQueues.map((queue) => queue.id),
      );
      return queueIds.map((queueId) => reviewableQueueIds.has(queueId));
    },
    { cache: false },
  );
  queueReviewabilityLoaders.set(context, loader);
  return loader;
}

export async function assertQueueIsReviewable(
  queue: { id: string; orgId: string },
  context: Context,
) {
  const user = context.getUser();
  if (user == null) {
    throw unauthenticatedError('User required.');
  }
  if (
    user.orgId !== queue.orgId ||
    !(await getQueueReviewabilityLoader(context).load(queue.id))
  ) {
    throw forbiddenError('User does not have access to this queue');
  }
  return user;
}
