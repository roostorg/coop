import { vi } from 'vitest';

import { UserPermission } from '../services/userManagementService/index.js';
import resolvers from './resolvers.js';

describe('Mutation.deleteInvite', () => {
  const deleteInvite = (resolvers.Mutation as Record<string, unknown>)
    .deleteInvite as (
    parent: unknown,
    args: { id: string },
    ctx: unknown,
  ) => Promise<unknown>;

  function makeCtx() {
    const serviceDeleteInvite = vi.fn(async () => true);
    const ctx = {
      getUser: () => ({
        id: 'admin-1',
        orgId: 'org-1',
        getPermissions: () => [UserPermission.MANAGE_USERS],
      }),
      services: {
        UserManagementService: { deleteInvite: serviceDeleteInvite },
      },
    };
    return { ctx, serviceDeleteInvite };
  }

  it('passes the invite id to the service as a number', async () => {
    const { ctx, serviceDeleteInvite } = makeCtx();
    await expect(deleteInvite({}, { id: '42' }, ctx)).resolves.toBe(true);
    expect(serviceDeleteInvite).toHaveBeenCalledWith(42, 'org-1');
  });

  it('rejects a non-numeric invite id without calling the service', async () => {
    const { ctx, serviceDeleteInvite } = makeCtx();
    await expect(
      deleteInvite({}, { id: 'not-a-number' }, ctx),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(serviceDeleteInvite).not.toHaveBeenCalled();
  });
});
