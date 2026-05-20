import { UserPermission } from '../../services/userManagementService/index.js';
import { Query } from './apiKey.js';

describe('apiKey resolvers', () => {
  function makeCtx(permissions: readonly UserPermission[]) {
    const getActiveApiKeyForOrg = jest.fn(async () => ({ key: 'secret' }));
    const ctx = {
      getUser: () => ({
        id: 'user-1',
        orgId: 'org-1',
        getPermissions: () => permissions,
      }),
      services: { ApiKeyService: { getActiveApiKeyForOrg } },
    };
    return { ctx, getActiveApiKeyForOrg };
  }

  describe('Query.apiKey', () => {
    it('throws unauthenticatedError when caller is not authenticated', async () => {
      const { ctx, getActiveApiKeyForOrg } = makeCtx([
        UserPermission.MANAGE_ORG,
      ]);
      const unauthenticatedCtx = { ...ctx, getUser: () => null };
      await expect(Query.apiKey({}, {}, unauthenticatedCtx)).rejects.toThrow(
        'Authenticated user required',
      );
      expect(getActiveApiKeyForOrg).not.toHaveBeenCalled();
    });

    it('throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, getActiveApiKeyForOrg } = makeCtx([UserPermission.VIEW_MRT]);
      await expect(Query.apiKey({}, {}, ctx)).rejects.toThrow(
        'User does not have permission to view the org API key',
      );
      expect(getActiveApiKeyForOrg).not.toHaveBeenCalled();
    });

    it('returns the existence indicator when caller has MANAGE_ORG', async () => {
      const { ctx, getActiveApiKeyForOrg } = makeCtx([
        UserPermission.MANAGE_ORG,
      ]);
      await expect(Query.apiKey({}, {}, ctx)).resolves.toBe(
        'API key exists (hidden for security)',
      );
      expect(getActiveApiKeyForOrg).toHaveBeenCalledWith('org-1');
    });
  });
});
