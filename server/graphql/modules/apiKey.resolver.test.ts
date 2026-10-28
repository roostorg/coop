import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql/index.js';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
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
    const testWithOrg = makeTransactionalTestWithFixture(async ({ deps }) => {
      const { org, apiKey } = await createOrg(deps);
      const { user } = await createUser(deps.KyselyPg, org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: 'Api-key-management-test-password-123!',
      });
      const { org: otherOrg } = await createOrg(deps);
      const foreignKey = await deps.ApiKeyService.createApiKey(
        otherOrg.id,
        'Foreign key',
        null,
        null,
      );
      return { org, apiKey, user, foreignKey };
    });

    const operations = [
      '{ apiKeys { id name isActive } }',
      'mutation { createApiKey(input: { name: "Reports" }) { apiKey record { id } } }',
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

    testWithOrg(
      'lists metadata and scopes creation and revocation to the authenticated organization',
      async ({ deps, request, org, apiKey, user, foreignKey }) => {
        const login = await request.post('/api/v1/graphql').send({
          query: `mutation Login($input: LoginInput!) {
            login(input: $input) { __typename }
          }`,
          variables: {
            input: {
              email: user.email,
              password: 'Api-key-management-test-password-123!',
            },
          },
        });
        expect(login.body.data?.login.__typename).toBe('LoginSuccessResponse');

        const created = await request.post('/api/v1/graphql').send({
          query: `mutation {
            createApiKey(input: { name: "Reports", description: "Report ingestion" }) {
              apiKey
              record { id name description isActive createdAt lastUsedAt createdBy }
            }
          }`,
        });
        expect(created.body.errors).toBeUndefined();
        const { apiKey: secret, record } = created.body.data.createApiKey;
        expect(record).toEqual({
          id: expect.any(String),
          name: 'Reports',
          description: 'Report ingestion',
          isActive: true,
          createdAt: expect.any(String),
          lastUsedAt: null,
          createdBy: user.id,
        });
        expect(await deps.ApiKeyService.validateApiKey(secret)).toBe(org.id);

        const listed = await request.post('/api/v1/graphql').send({
          query:
            '{ apiKeys { id name description isActive createdAt lastUsedAt createdBy } }',
        });
        expect(listed.body.errors).toBeUndefined();
        expect(listed.body.data.apiKeys).toHaveLength(2);
        expect(listed.body.data.apiKeys).toEqual(
          expect.arrayContaining([
            { ...record, lastUsedAt: expect.any(String) },
          ]),
        );
        expect(listed.body.data.apiKeys).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: foreignKey.record.id }),
          ]),
        );

        const foreignRevocation = await request.post('/api/v1/graphql').send({
          query: 'mutation Revoke($id: ID!) { revokeApiKey(id: $id) }',
          variables: { id: foreignKey.record.id },
        });
        expect(foreignRevocation.body.errors).toBeUndefined();
        expect(foreignRevocation.body.data.revokeApiKey).toBe(false);
        expect(await deps.ApiKeyService.validateApiKey(foreignKey.apiKey)).toBe(
          foreignKey.record.orgId,
        );

        const revoked = await request.post('/api/v1/graphql').send({
          query: 'mutation Revoke($id: ID!) { revokeApiKey(id: $id) }',
          variables: { id: record.id },
        });
        expect(revoked.body.errors).toBeUndefined();
        expect(revoked.body.data.revokeApiKey).toBe(true);
        expect(await deps.ApiKeyService.validateApiKey(secret)).toBeNull();
        expect(await deps.ApiKeyService.validateApiKey(apiKey)).toBe(org.id);

        const stored = await deps.KyselyPg.selectFrom('public.api_keys')
          .select(['org_id', 'created_by', 'is_active'])
          .where('id', '=', record.id)
          .executeTakeFirstOrThrow();
        expect(stored).toEqual({
          org_id: org.id,
          created_by: user.id,
          is_active: false,
        });
        const hiddenHash = await request.post('/api/v1/graphql').send({
          query: '{ apiKeys { keyHash } }',
        });
        expect(hiddenHash.body.errors?.[0].message).toContain(
          'Cannot query field "keyHash"',
        );
      },
    );
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
