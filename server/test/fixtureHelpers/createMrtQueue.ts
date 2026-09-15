import type { Dependencies } from '../../iocContainer/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';

export default async function (opts: {
  orgId: string;
  mrtService: Dependencies['ManualReviewToolService'];
  userId: string;
  /** Queue names are unique per org; pass one to make a second queue. */
  name?: string;
}) {
  const { orgId, mrtService, userId, name = 'test-queue' } = opts;

  const queue = await mrtService.createManualReviewQueue({
    name,
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
