import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql/index.js';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import {
  type GQLCreateApiKeySuccessResponse,
  type GQLRotateApiKeySuccessResponse,
} from '../generated.js';
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
    args: { input: { id: string; name: string; description?: string | null } },
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
      const { user } = await createUser(deps.KyselyPg, org.id);
      const execute = async (
        source: string,
        variableValues?: Record<string, unknown>,
      ) =>
        graphql({
          schema,
          source,
          variableValues,
          contextValue: { getUser: () => user, services: deps },
        });
      const { org: otherOrg } = await createOrg(deps);
      const foreignKey = await deps.ApiKeyService.createApiKey(
        otherOrg.id,
        'Foreign key',
        null,
        null,
      );
      return { org, apiKey, user, foreignKey, execute };
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
      async ({ deps, execute, org, apiKey, user, foreignKey }) => {
        const created = await execute(`mutation {
            createApiKey(input: { name: "Reports", description: "Report ingestion" }) {
              apiKey
              record { id name description isActive createdAt lastUsedAt createdBy }
            }
          }`);
        expect(created.errors).toBeUndefined();
        const { apiKey: secret, record } = created.data!
          .createApiKey as GQLCreateApiKeySuccessResponse;
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

        const listed = await execute(
          '{ apiKeys { id name description isActive createdAt lastUsedAt createdBy } }',
        );
        expect(listed.errors).toBeUndefined();
        expect(listed.data!.apiKeys).toHaveLength(2);
        expect(listed.data!.apiKeys).toEqual(
          expect.arrayContaining([
            { ...record, lastUsedAt: expect.any(String) },
          ]),
        );
        expect(listed.data!.apiKeys).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: foreignKey.record.id }),
          ]),
        );

        const foreignRevocation = await execute(
          'mutation Revoke($id: ID!) { revokeApiKey(id: $id) }',
          { id: foreignKey.record.id },
        );
        expect(foreignRevocation.errors).toBeUndefined();
        expect(foreignRevocation.data!.revokeApiKey).toBe(false);
        expect(await deps.ApiKeyService.validateApiKey(foreignKey.apiKey)).toBe(
          foreignKey.record.orgId,
        );

        const revoked = await execute(
          'mutation Revoke($id: ID!) { revokeApiKey(id: $id) }',
          { id: record.id },
        );
        expect(revoked.errors).toBeUndefined();
        expect(revoked.data!.revokeApiKey).toBe(true);
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
        const hiddenHash = await execute('{ apiKeys { keyHash } }');
        expect(hiddenHash.errors?.[0].message).toContain(
          'Cannot query field "keyHash"',
        );
      },
    );

    testWithOrg(
      'rotation requires an explicit active key in the authenticated organization and never creates a key',
      async ({ deps, execute, org, apiKey, foreignKey }) => {
        const [selected] = await deps.ApiKeyService.getApiKeysForOrg(org.id);
        const other = await deps.ApiKeyService.createApiKey(
          org.id,
          'Other',
          null,
          null,
        );
        const query = `mutation Rotate($input: RotateApiKeyInput!) {
          rotateApiKey(input: $input) {
            __typename
            ... on RotateApiKeySuccessResponse { apiKey record { id } }
          }
        }`;
        for (const input of [
          { name: 'Rotated' },
          { name: 'Rotated', id: null },
        ]) {
          const response = await execute(query, { input });
          expect(response.errors?.[0].message).toContain('ID!');
        }
        for (const id of [
          '00000000-0000-4000-8000-000000000000',
          foreignKey.record.id,
        ]) {
          const response = await execute(query, {
            input: { name: 'Rotated', id },
          });
          expect(response.errors).toBeUndefined();
          expect(response.data!.rotateApiKey).toMatchObject({
            __typename: 'RotateApiKeyError',
          });
        }
        expect(await deps.ApiKeyService.getOrgIdFromActivatedKey(apiKey)).toBe(
          org.id,
        );
        const rotated = await execute(query, {
          input: { name: 'Rotated', id: selected.id },
        });
        expect(rotated.errors).toBeUndefined();
        const rotatedKey = rotated.data!
          .rotateApiKey as GQLRotateApiKeySuccessResponse;
        expect(rotatedKey.record.id).toBe(selected.id);
        expect(
          await deps.ApiKeyService.getOrgIdFromActivatedKey(apiKey),
        ).toBeNull();
        expect(
          await deps.ApiKeyService.getOrgIdFromActivatedKey(rotatedKey.apiKey),
        ).toBe(org.id);
        expect(
          await deps.ApiKeyService.getOrgIdFromActivatedKey(other.apiKey),
        ).toBe(org.id);
        expect(
          await deps.ApiKeyService.getOrgIdFromActivatedKey(foreignKey.apiKey),
        ).toBe(foreignKey.record.orgId);

        await deps.ApiKeyService.deactivateApiKey(selected.id, org.id);
        const revoked = await execute(query, {
          input: { name: 'Rotated', id: selected.id },
        });
        expect(revoked.errors).toBeUndefined();
        expect(revoked.data!.rotateApiKey).toMatchObject({
          __typename: 'RotateApiKeyError',
        });
        expect(await deps.ApiKeyService.getApiKeysForOrg(org.id)).toHaveLength(
          2,
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
      const introspection = await graphql({
        schema,
        source: `{ __type(name: "Query") {
          fields(includeDeprecated: true) { name isDeprecated deprecationReason }
        } }`,
      });
      expect(introspection.errors).toBeUndefined();
      expect(introspection.data?.__type).toMatchObject({
        fields: expect.arrayContaining([
          {
            name: 'apiKey',
            isDeprecated: true,
            deprecationReason: 'Use `apiKeys` instead.',
          },
        ]),
      });
    });
  });

  describe('Mutation.rotateApiKey', () => {
    it('throws unauthenticatedError when caller is not authenticated', async () => {
      const { ctx, rotateApiKey } = makeCtx([UserPermission.MANAGE_ORG]);
      const unauthenticatedCtx = { ...ctx, getUser: () => null };
      await expect(
        Mutation.rotateApiKey(
          {},
          { input: { id: 'key-2', name: 'k', description: null } },
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
          { input: { id: 'key-2', name: 'k', description: null } },
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
