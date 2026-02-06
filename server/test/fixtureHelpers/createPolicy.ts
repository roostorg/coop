import { faker } from '@faker-js/faker';

import { type Dependencies } from '../../iocContainer/index.js';
import { UserPermission } from '../../models/types/permissioning.js';

export default async function (opts: {
  moderationConfigService: Dependencies['ModerationConfigService'];
  orgId: string;
}) {
  const { moderationConfigService, orgId } = opts;
  const policy = await moderationConfigService.createPolicy({
    policy: {
      name: faker.music.genre(),
      parentId: null,
      policyText: null,
      enforcementGuidelines: null,
      policyType: null,
    },
    invokedBy: {
      userId: '',
      permissions: [UserPermission.MANAGE_POLICIES],
      orgId,
    },
    orgId,
  });

  return {
    policy,
    async cleanup() {
      await moderationConfigService.deletePolicy({
        policyId: policy.id,
        orgId,
        invokedBy: {
          userId: '',
          permissions: [UserPermission.MANAGE_POLICIES],
          orgId,
        },
      });
    },
  };
}
