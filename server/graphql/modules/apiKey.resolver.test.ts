import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql/index.js';
import { vi } from 'vitest';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { type GQLCreateApiKeySuccessResponse } from '../generated.js';
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
      '{ apiKeys { id name } }',
      'mutation { createApiKey(input: { name: "Reports" }) { apiKey record { id } } }',
      'mutation { deleteApiKey(id: "key-2") }',
      'mutation { updateApiKey(input: { id: "key-2", name: "Renamed" }) { id } }',
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
      'creates, edits, and deletes only keys in the authenticated organization',
      async ({ deps, execute, org, apiKey, user, foreignKey }) => {
        const created = await execute(`mutation {
            createApiKey(input: { name: "Reports", description: "Report ingestion" }) {
              apiKey
              record { id name description createdAt lastUsedAt createdBy }
            }
          }`);
        expect(created.errors).toBeUndefined();
        const { apiKey: secret, record } = created.data!
          .createApiKey as GQLCreateApiKeySuccessResponse;
        expect(record).toEqual({
          id: expect.any(String),
          name: 'Reports',
          description: 'Report ingestion',
          createdAt: expect.any(String),
          lastUsedAt: null,
          createdBy: user.id,
        });
        expect(await deps.ApiKeyService.validateApiKey(secret)).toBe(org.id);

        const listed = await execute(
          '{ apiKeys { id name description createdAt lastUsedAt createdBy } }',
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

        const update = `mutation Update($id: ID!) {
          updateApiKey(input: { id: $id, name: "Renamed reports", description: null }) {
            id name description createdAt lastUsedAt createdBy
          }
        }`;
        const edited = await execute(update, { id: record.id });
        expect(edited.errors).toBeUndefined();
        expect(edited.data!.updateApiKey).toEqual({
          ...record,
          name: 'Renamed reports',
          description: null,
          lastUsedAt: expect.any(String),
        });
        expect(await deps.ApiKeyService.getOrgIdFromActivatedKey(secret)).toBe(
          org.id,
        );
        const foreignEdit = await execute(update, { id: foreignKey.record.id });
        expect(foreignEdit.errors).toBeUndefined();
        expect(foreignEdit.data!.updateApiKey).toBeNull();

        const foreignDeletion = await execute(
          'mutation Delete($id: ID!) { deleteApiKey(id: $id) }',
          { id: foreignKey.record.id },
        );
        expect(foreignDeletion.errors).toBeUndefined();
        expect(foreignDeletion.data!.deleteApiKey).toBe(false);
        expect(await deps.ApiKeyService.validateApiKey(foreignKey.apiKey)).toBe(
          foreignKey.record.orgId,
        );

        const deleted = await execute(
          'mutation Delete($id: ID!) { deleteApiKey(id: $id) }',
          { id: record.id },
        );
        expect(deleted.errors).toBeUndefined();
        expect(deleted.data!.deleteApiKey).toBe(true);
        expect(await deps.ApiKeyService.validateApiKey(secret)).toBeNull();
        expect(await deps.ApiKeyService.validateApiKey(apiKey)).toBe(org.id);

        const stored = await deps.KyselyPg.selectFrom('public.api_keys')
          .select('id')
          .where('id', '=', record.id)
          .executeTakeFirst();
        expect(stored).toBeUndefined();
        const deletedAgain = await execute(
          'mutation Delete($id: ID!) { deleteApiKey(id: $id) }',
          { id: record.id },
        );
        expect(deletedAgain.errors).toBeUndefined();
        expect(deletedAgain.data!.deleteApiKey).toBe(false);
        const hiddenHash = await execute('{ apiKeys { keyHash } }');
        expect(hiddenHash.errors?.[0].message).toContain(
          'Cannot query field "keyHash"',
        );
      },
    );

    testWithOrg(
      'excludes inactive database keys from management and authentication',
      async ({ deps, org, execute }) => {
        const { apiKey, record } = await deps.ApiKeyService.createApiKey(
          org.id,
          'Inactive key',
          null,
          null,
        );
        await deps.KyselyPg.updateTable('public.api_keys')
          .set({ is_active: false })
          .where('id', '=', record.id)
          .execute();

        const listed = await execute('{ apiKeys { id } }');
        expect(listed.errors).toBeUndefined();
        expect(listed.data!.apiKeys).not.toContainEqual({ id: record.id });
        const edited = await execute(
          'mutation Edit($id: ID!) { updateApiKey(input: { id: $id, name: "Renamed" }) { id } }',
          { id: record.id },
        );
        expect(edited.errors).toBeUndefined();
        expect(edited.data!.updateApiKey).toBeNull();
        expect(await deps.ApiKeyService.validateApiKey(apiKey)).toBeNull();
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
