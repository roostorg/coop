import jwt from 'jsonwebtoken';

import { UserPermission } from '../../services/userManagementService/index.js';
import { resolvers } from './user.js';

describe('user resolvers', () => {
  describe('Mutation.deleteUser', () => {
    function makeCtx(permissions: readonly UserPermission[]) {
      const deleteUser = jest.fn(async () => true);
      const ctx = {
        getUser: () => ({
          id: 'admin-1',
          orgId: 'org-1',
          getPermissions: () => permissions,
        }),
        dataSources: { userAPI: { deleteUser } },
      };
      return { ctx, deleteUser };
    }

    const Mutation = resolvers.Mutation as {
      deleteUser: (
        parent: unknown,
        args: { id: string },
        ctx: unknown,
      ) => Promise<unknown>;
    };

    it('throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, deleteUser } = makeCtx([
        UserPermission.VIEW_MRT,
        UserPermission.VIEW_MRT_DATA,
      ]);
      await expect(
        Mutation.deleteUser({}, { id: 'victim-1' }, ctx),
      ).rejects.toThrow('User does not have permission to delete users');
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('delegates to userAPI.deleteUser when caller has MANAGE_ORG', async () => {
      const { ctx, deleteUser } = makeCtx([UserPermission.MANAGE_ORG]);
      await expect(
        Mutation.deleteUser({}, { id: 'victim-1' }, ctx),
      ).resolves.toBe(true);
      expect(deleteUser).toHaveBeenCalledWith({
        id: 'victim-1',
        orgId: 'org-1',
      });
    });
  });

  describe('User.readMeJWT does not leak org secrets to non-admins', () => {
    const TEST_JWT_SECRET = 'test-readme-jwt-secret';
    let originalSecret: string | undefined;

    beforeAll(() => {
      originalSecret = process.env.READ_ME_JWT_SECRET;
      process.env.READ_ME_JWT_SECRET = TEST_JWT_SECRET;
    });
    afterAll(() => {
      if (originalSecret == null) {
        delete process.env.READ_ME_JWT_SECRET;
      } else {
        process.env.READ_ME_JWT_SECRET = originalSecret;
      }
    });

    function makeReadMeCtx(permissions: readonly UserPermission[]) {
      const getActivatedApiKeyForOrg = jest.fn(async () => ({
        key: 'org-api-key-SHOULD-NEVER-LEAK',
      }));
      const getPublicSigningKeyPem = jest.fn(async () => 'SIGNING_KEY_PEM');
      const ctx = {
        getUser: () => ({
          id: 'user-1',
          orgId: 'org-1',
          getPermissions: () => permissions,
        }),
        dataSources: {
          orgAPI: { getActivatedApiKeyForOrg, getPublicSigningKeyPem },
        },
      };
      return { ctx, getActivatedApiKeyForOrg, getPublicSigningKeyPem };
    }

    const userParent = {
      id: 'user-1',
      orgId: 'org-1',
      email: 't@example.com',
      firstName: 'Test',
      lastName: 'User',
    };

    const User = resolvers.User as {
      readMeJWT: (
        parent: typeof userParent,
        args: unknown,
        ctx: unknown,
      ) => Promise<string | null>;
    };

    it('returns a JWT with null apiKey/publicSigningKey for non-MANAGE_ORG callers', async () => {
      const { ctx, getActivatedApiKeyForOrg, getPublicSigningKeyPem } =
        makeReadMeCtx([UserPermission.VIEW_MRT]);
      const token = await User.readMeJWT(userParent, {}, ctx);
      expect(token).not.toBeNull();
      const payload = jwt.verify(token as string, TEST_JWT_SECRET) as Record<
        string,
        unknown
      >;
      expect(payload.apiKey).toBeNull();
      expect(payload.publicSigningKey).toBeNull();
      expect(payload.email).toBe('t@example.com');
      // The data sources should never be hit when the caller has no claim
      // to the org secrets — protects against perf-cost amplification too.
      expect(getActivatedApiKeyForOrg).not.toHaveBeenCalled();
      expect(getPublicSigningKeyPem).not.toHaveBeenCalled();
    });

    it('embeds org secrets in the JWT for MANAGE_ORG callers', async () => {
      const { ctx, getActivatedApiKeyForOrg, getPublicSigningKeyPem } =
        makeReadMeCtx([UserPermission.MANAGE_ORG]);
      const token = await User.readMeJWT(userParent, {}, ctx);
      expect(token).not.toBeNull();
      const payload = jwt.verify(token as string, TEST_JWT_SECRET) as Record<
        string,
        unknown
      >;
      expect(payload.apiKey).toBe('org-api-key-SHOULD-NEVER-LEAK');
      expect(payload.publicSigningKey).toBe('SIGNING_KEY_PEM');
      expect(getActivatedApiKeyForOrg).toHaveBeenCalledWith('org-1');
      expect(getPublicSigningKeyPem).toHaveBeenCalledWith('org-1');
    });
  });
});
