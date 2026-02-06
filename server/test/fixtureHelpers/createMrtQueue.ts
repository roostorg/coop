import type { Dependencies } from '../../iocContainer/index.js';
import { UserPermission } from '../../models/types/permissioning.js';

export default async function (opts: {
  orgId: string;
  mrtService: Dependencies['ManualReviewToolService'];
  userId: string;
}) {
  const { orgId, mrtService, userId } = opts;

  const queue = await mrtService.createManualReviewQueue({
    name: 'test-queue',
    description: null,
    userIds: [userId],
    hiddenActionIds: [],
    isAppealsQueue: false,
    invokedBy: {
      userId,
      permissions: [UserPermission.EDIT_MRT_QUEUES],
      orgId,
    },
  });

  return {
    queue,
    async cleanup() {
      return mrtService.deleteManualReviewQueueForTestsDO_NOT_USE(
        orgId,
        queue.id,
      );
    },
  };
}
