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

    it('throws forbiddenError when caller lacks MANAGE_USERS', async () => {
      const { ctx, deleteUser } = makeCtx([
        UserPermission.VIEW_MRT,
        UserPermission.VIEW_MRT_DATA,
        // Carrying MANAGE_ORG without MANAGE_USERS used to be enough; after
        // the permission split for the role-editor (issue #406) user-mutation
        // resolvers gate strictly on MANAGE_USERS, so this caller must be
        // rejected even though they hold the legacy "highest-impact" cap.
        UserPermission.MANAGE_ORG,
      ]);
      await expect(
        Mutation.deleteUser({}, { id: 'victim-1' }, ctx),
      ).rejects.toThrow('User does not have permission to delete users');
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('delegates to userAPI.deleteUser when caller has MANAGE_USERS', async () => {
      const { ctx, deleteUser } = makeCtx([UserPermission.MANAGE_USERS]);
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

    // Narrow the resolver's `Promise<string | null>` to a string and decode
    // the JWT in one place so individual tests stay focused on the assertions
    // that matter to them. Throws (and fails the test) if the resolver
    // unexpectedly returns null or jwt.verify yields a string payload.
    async function decodeReadMeJWT(
      token: string | null,
    ): Promise<jwt.JwtPayload> {
      expect(token).not.toBeNull();
      if (token == null) {
        throw new Error('readMeJWT returned null');
      }
      const decoded = jwt.verify(token, TEST_JWT_SECRET);
      if (typeof decoded === 'string') {
        throw new Error('readMeJWT decoded to a string payload');
      }
      return decoded;
    }

    it('returns a JWT with null apiKey/publicSigningKey for non-MANAGE_ORG callers', async () => {
      const { ctx, getActivatedApiKeyForOrg, getPublicSigningKeyPem } =
        makeReadMeCtx([UserPermission.VIEW_MRT]);
      const payload = await decodeReadMeJWT(
        await User.readMeJWT(userParent, {}, ctx),
      );
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
      const payload = await decodeReadMeJWT(
        await User.readMeJWT(userParent, {}, ctx),
      );
      expect(payload.apiKey).toBe('org-api-key-SHOULD-NEVER-LEAK');
      expect(payload.publicSigningKey).toBe('SIGNING_KEY_PEM');
      expect(getActivatedApiKeyForOrg).toHaveBeenCalledWith('org-1');
      expect(getPublicSigningKeyPem).toHaveBeenCalledWith('org-1');
    });

    it('returns null and skips the orgAPI when the parent user does not match the authenticated user', async () => {
      // The identity guard must short-circuit before any secret lookup —
      // otherwise a privileged user could query readMeJWT against another
      // user's parent and surface their org secrets in the resulting JWT.
      const { ctx, getActivatedApiKeyForOrg, getPublicSigningKeyPem } =
        makeReadMeCtx([UserPermission.MANAGE_ORG]);
      const otherUser = { ...userParent, id: 'different-user' };
      await expect(User.readMeJWT(otherUser, {}, ctx)).resolves.toBeNull();
      expect(getActivatedApiKeyForOrg).not.toHaveBeenCalled();
      expect(getPublicSigningKeyPem).not.toHaveBeenCalled();
    });
  });
});
