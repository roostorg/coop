import type { Dependencies } from '../../iocContainer/index.js';
import { UserPermission } from '../../services/userManagementService/index.js';

export default async function (opts: {
  orgId: string;
  mrtService: Dependencies['ManualReviewToolService'];
  userId: string;
  name?: string;
}) {
  const { orgId, mrtService, userId, name = 'test-queue' } = opts;

  const queue = await mrtService.createManualReviewQueue({
    name,
    description: null,
    userIds: [userId],
    roleIds: [],
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
