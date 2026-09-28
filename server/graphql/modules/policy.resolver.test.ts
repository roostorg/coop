import { type GraphQLResolveInfo } from 'graphql';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import { type Context } from '../resolvers.js';
import { resolvers } from './policy.js';

const updatePolicy = resolvers.Mutation.updatePolicy;

describe('updatePolicy resolver', () => {
  it('passes the authenticated user as invokedBy', async () => {
    const service = { updatePolicy: vi.fn().mockResolvedValue({ id: 'p' }) };
    const context = {
      getUser: () => ({
        id: 'user-id',
        orgId: 'org-id',
        getPermissions: () => [UserPermission.MANAGE_POLICIES],
      }),
      services: { ModerationConfigService: service },
    } as unknown as Context;
    if (typeof updatePolicy !== 'function')
      throw new Error('Missing updatePolicy resolver');

    await updatePolicy(
      {},
      { input: { id: 'policy-id', name: 'Policy' } },
      context,
      {} as GraphQLResolveInfo,
    );

    expect(service.updatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        invokedBy: {
          userId: 'user-id',
          orgId: 'org-id',
          permissions: [UserPermission.MANAGE_POLICIES],
        },
      }),
    );
  });
});
