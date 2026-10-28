import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql/index.js';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import {
  Mutation as MutationResolvers,
  Query as QueryResolvers,
  resolvers,
  typeDefs,
} from './apiKey.js';

const Query = QueryResolvers as {
  apiKey: (
    parent: unknown,
    args: Record<string, never>,
    ctx: unknown,
  ) => Promise<string>;
};

const Mutation = MutationResolvers as {
  rotateApiKey: (
    parent: unknown,
    args: { input: { name: string; description?: string | null } },
    ctx: unknown,
  ) => Promise<unknown>;
  rotateWebhookSigningKey: (
    parent: unknown,
    args: Record<string, never>,
    ctx: unknown,
  ) => Promise<unknown>;
};

describe('apiKey resolvers', () => {
  const schema = makeExecutableSchema({
    typeDefs: [
      typeDefs,
      `interface Error { title: String! status: Int! type: [String!]! pointer: String detail: String requestId: String }`,
    ],
    resolvers,
  });

  function makeCtx(permissions: readonly UserPermission[]) {
    const getActiveApiKeyForOrg = vi.fn(async () => ({ key: 'secret' }));
    const rotateApiKey = vi.fn();
    const rotateWebhookSigningKey = vi.fn();
    const ctx = {
      getUser: () => ({
        id: 'user-1',
        orgId: 'org-1',
        getPermissions: () => permissions,
      }),
      services: {
        ApiKeyService: { getActiveApiKeyForOrg, rotateApiKey },
      },
      dataSources: { orgAPI: { rotateWebhookSigningKey } },
    };
    return {
      ctx,
      getActiveApiKeyForOrg,
      rotateApiKey,
      rotateWebhookSigningKey,
    };
  }

  describe('multiple-key management', () => {
    const operations = [
      '{ apiKeys { id name isActive } }',
      'mutation { createApiKey(input: { name: "Reports", permissions: ["reports:write"] }) { apiKey record { id permissions } } }',
      'mutation { revokeApiKey(id: "key-2") }',
    ];

    it.each(operations)('requires an administrator for %s', async (source) => {
      const { ctx } = makeCtx([UserPermission.VIEW_MRT]);
      const forbidden = await graphql({ schema, source, contextValue: ctx });
      expect(forbidden.errors?.[0].message).toBe(
        'User does not have permission to manage API keys',
      );
      const unauthenticated = await graphql({
        schema,
        source,
        contextValue: { ...ctx, getUser: () => null },
      });
      expect(unauthenticated.errors?.[0].message).toBe(
        'Authenticated user required',
      );
    });

    it('lists metadata and scopes creation and revocation to the authenticated organization', async () => {
      const record = {
        id: 'key-2',
        orgId: 'org-1',
        keyHash: 'not-public',
        name: 'Reports',
        description: null,
        permissions: ['reports:write'],
        isActive: true,
        createdAt: new Date('2026-01-01'),
        lastUsedAt: null,
        createdBy: 'user-1',
      };
      const { ctx } = makeCtx([UserPermission.MANAGE_ORG]);
      const service = {
        getApiKeysForOrg: vi.fn(async () => [record]),
        createApiKey: vi.fn(async () => ({ apiKey: 'new-secret', record })),
        deactivateApiKey: vi.fn(async () => true),
      };
      const contextValue = { ...ctx, services: { ApiKeyService: service } };
      const listed = await graphql({
        schema,
        source:
          '{ apiKeys { id name description permissions isActive createdAt lastUsedAt createdBy } }',
        contextValue,
      });
      expect(listed.errors).toBeUndefined();
      expect(listed.data?.apiKeys).toEqual([
        {
          id: 'key-2',
          name: 'Reports',
          description: null,
          permissions: ['reports:write'],
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          lastUsedAt: null,
          createdBy: 'user-1',
        },
      ]);
      expect(service.getApiKeysForOrg).toHaveBeenCalledWith('org-1');
      const created = await graphql({
        schema,
        source: operations[1],
        contextValue,
      });
      expect(created.errors).toBeUndefined();
      expect(created.data?.createApiKey).toEqual({
        apiKey: 'new-secret',
        record: { id: 'key-2', permissions: ['reports:write'] },
      });
      expect(service.createApiKey).toHaveBeenCalledWith(
        'org-1',
        'Reports',
        null,
        'user-1',
        ['reports:write'],
      );
      const revoked = await graphql({
        schema,
        source: operations[2],
        contextValue,
      });
      expect(revoked.errors).toBeUndefined();
      expect(revoked.data?.revokeApiKey).toBe(true);
      expect(service.deactivateApiKey).toHaveBeenCalledWith('key-2', 'org-1');
      const secret = await graphql({
        schema,
        source: '{ apiKeys { keyHash } }',
        contextValue,
      });
      expect(secret.errors?.[0].message).toContain(
        'Cannot query field "keyHash"',
      );
    });
  });

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

  describe('Mutation.rotateApiKey', () => {
    it('throws unauthenticatedError when caller is not authenticated', async () => {
      const { ctx, rotateApiKey } = makeCtx([UserPermission.MANAGE_ORG]);
      const unauthenticatedCtx = { ...ctx, getUser: () => null };
      await expect(
        Mutation.rotateApiKey(
          {},
          { input: { name: 'k', description: null } },
          unauthenticatedCtx,
        ),
      ).rejects.toThrow('Authenticated user required');
      expect(rotateApiKey).not.toHaveBeenCalled();
    });

    it('throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, rotateApiKey } = makeCtx([UserPermission.VIEW_MRT]);
      await expect(
        Mutation.rotateApiKey(
          {},
          { input: { name: 'k', description: null } },
          ctx,
        ),
      ).rejects.toThrow('User does not have permission to rotate the API key');
      expect(rotateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.rotateWebhookSigningKey', () => {
    it('throws unauthenticatedError when caller is not authenticated', async () => {
      const { ctx, rotateWebhookSigningKey } = makeCtx([
        UserPermission.MANAGE_ORG,
      ]);
      const unauthenticatedCtx = { ...ctx, getUser: () => null };
      await expect(
        Mutation.rotateWebhookSigningKey({}, {}, unauthenticatedCtx),
      ).rejects.toThrow('Authenticated user required');
      expect(rotateWebhookSigningKey).not.toHaveBeenCalled();
    });

    it('throws forbiddenError when caller lacks MANAGE_ORG', async () => {
      const { ctx, rotateWebhookSigningKey } = makeCtx([
        UserPermission.VIEW_MRT,
      ]);
      await expect(
        Mutation.rotateWebhookSigningKey({}, {}, ctx),
      ).rejects.toThrow(
        'User does not have permission to rotate the webhook signing key',
      );
      expect(rotateWebhookSigningKey).not.toHaveBeenCalled();
    });
  });
});
