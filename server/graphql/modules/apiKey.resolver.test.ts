import fc from 'fast-check';

import { UserPermission } from '../../services/userManagementService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createSession from '../../test/fixtureHelpers/createSession.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';
import { jsonStringify } from '../../utils/encoding.js';
import { kyselyUpdateRolePermissions } from '../datasources/rolePersistence.js';

describe('API key GraphQL authorization', () => {
  const unrelatedPermissions = Object.values(UserPermission).filter(
    (permission) => permission !== UserPermission.MANAGE_ORG,
  );
  const rotateApiKey = /* GraphQL */ `
    mutation {
      rotateApiKey(input: { name: "replacement", description: "test key" }) {
        __typename
        ... on RotateApiKeySuccessResponse {
          apiKey
          record {
            id
            name
            description
            isActive
            createdBy
          }
        }
      }
    }
  `;
  const rotateWebhookSigningKey = /* GraphQL */ `
    mutation {
      rotateWebhookSigningKey {
        __typename
        ... on RotateWebhookSigningKeySuccessResponse {
          publicSigningKey
        }
      }
    }
  `;
  const testWithKeys = makeTransactionalTestWithFixture(
    async ({ deps, server }) => {
      const local = await createOrg(deps);
      const foreign = await createOrg(deps);
      const { user } = await createUser(deps.KyselyPg, local.org.id, {
        approvedByAdmin: true,
        loginMethods: ['password'],
        password: 'Api-key-test-password',
      });
      for (const tenant of [local, foreign]) {
        await deps.SigningKeyPairService.createAndStoreSigningKeys(
          tenant.org.id,
        );
      }
      const snapshot = async () => ({
        apiKeys: await deps.KyselyPg.selectFrom('public.api_keys')
          .selectAll()
          .where('org_id', 'in', [local.org.id, foreign.org.id])
          .orderBy('id')
          .execute(),
        signingKeys: await deps.KyselyPg.selectFrom('public.signing_keys')
          .selectAll()
          .where('org_id', 'in', [local.org.id, foreign.org.id])
          .orderBy('org_id')
          .execute(),
      });
      const session = await createSession(
        server,
        user.email,
        'Api-key-test-password',
      );
      return { local, foreign, user, session, snapshot };
    },
  );

  for (const [operation, query] of [
    ['Query.apiKey', '{ apiKey }'],
    ['Org.apiKey', '{ myOrg { apiKey } }'],
    ['Org.publicSigningKey', '{ myOrg { publicSigningKey } }'],
    ['Mutation.rotateApiKey', rotateApiKey],
    ['Mutation.rotateWebhookSigningKey', rotateWebhookSigningKey],
  ]) {
    describe(operation, () => {
      testWithKeys(
        'rejects unauthenticated requests without disclosing or changing keys',
        async ({ local, foreign, request, snapshot }) => {
          const before = await snapshot();

          const response = await request
            .post('/api/v1/graphql')
            .send({ query })
            .expect(200);

          expect(response.body.errors).toEqual([
            expect.objectContaining({
              extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
            }),
          ]);
          for (const secret of [
            local.apiKey,
            foreign.apiKey,
            ...before.apiKeys.map((key) => key.key_hash),
          ])
            expect(jsonStringify(response.body)).not.toContain(secret);
          expect(jsonStringify(response.body)).not.toContain(
            'BEGIN PUBLIC KEY',
          );
          expect(await snapshot()).toEqual(before);
        },
      );

      testWithKeys(
        'requires MANAGE_ORG regardless of other permissions',
        async ({ deps, local, foreign, user, session, snapshot }) => {
          const before = await snapshot();

          await fc.assert(
            fc.asyncProperty(
              fc.subarray(unrelatedPermissions),
              async (permissions) => {
                await kyselyUpdateRolePermissions(deps.KyselyPg, {
                  orgId: user.orgId,
                  roleKey: user.role,
                  permissions,
                });

                const response = await session
                  .post('/api/v1/graphql')
                  .send({ query })
                  .expect(200);

                expect(response.body.errors).toEqual([
                  expect.objectContaining({
                    extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
                  }),
                ]);
                for (const secret of [
                  local.apiKey,
                  foreign.apiKey,
                  ...before.apiKeys.map((key) => key.key_hash),
                ])
                  expect(jsonStringify(response.body)).not.toContain(secret);
                expect(jsonStringify(response.body)).not.toContain(
                  'BEGIN PUBLIC KEY',
                );
                expect(await snapshot()).toEqual(before);
              },
            ),
            { numRuns: 10, examples: [[[]], [unrelatedPermissions]] },
          );
        },
      );
    });
  }

  testWithKeys(
    'MANAGE_ORG can check that an API key exists without revealing it',
    async ({ deps, user, session }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.MANAGE_ORG],
      });

      const response = await session
        .post('/api/v1/graphql')
        .send({ query: '{ apiKey }' })
        .expect(200);

      expect(response.body).toEqual({
        data: { apiKey: 'API key exists (hidden for security)' },
      });
    },
  );

  testWithKeys(
    'MANAGE_ORG rotates only the caller API key and returns the usable replacement',
    async ({ deps, local, foreign, user, session, snapshot }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.MANAGE_ORG],
      });
      const before = await snapshot();

      const response = await session
        .post('/api/v1/graphql')
        .send({ query: rotateApiKey })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      const rotated = response.body.data.rotateApiKey;
      expect(rotated).toEqual({
        __typename: 'RotateApiKeySuccessResponse',
        apiKey: expect.any(String),
        record: {
          id: expect.any(String),
          name: 'replacement',
          description: 'test key',
          isActive: true,
          createdBy: user.id,
        },
      });
      const after = await snapshot();
      expect(
        after.apiKeys.filter((key) => key.org_id === foreign.org.id),
      ).toEqual(before.apiKeys.filter((key) => key.org_id === foreign.org.id));
      expect(after.signingKeys).toEqual(before.signingKeys);
      expect(await deps.ApiKeyService.validateApiKey(local.apiKey)).toBeNull();
      expect(await deps.ApiKeyService.validateApiKey(rotated.apiKey)).toBe(
        local.org.id,
      );
      expect(await deps.ApiKeyService.validateApiKey(foreign.apiKey)).toBe(
        foreign.org.id,
      );
    },
  );

  testWithKeys(
    'MANAGE_ORG rotates only the caller persisted webhook signing key',
    async ({ deps, local, foreign, user, session, snapshot }) => {
      await kyselyUpdateRolePermissions(deps.KyselyPg, {
        orgId: user.orgId,
        roleKey: user.role,
        permissions: [UserPermission.MANAGE_ORG],
      });
      const before = await snapshot();
      const previous = await session
        .post('/api/v1/graphql')
        .send({ query: '{ myOrg { publicSigningKey } }' });
      expect(previous.body.errors).toBeUndefined();

      const response = await session
        .post('/api/v1/graphql')
        .send({ query: rotateWebhookSigningKey })
        .expect(200);

      expect(response.body).toEqual({
        data: {
          rotateWebhookSigningKey: {
            __typename: 'RotateWebhookSigningKeySuccessResponse',
            publicSigningKey: expect.stringContaining('BEGIN PUBLIC KEY'),
          },
        },
      });
      const current =
        response.body.data.rotateWebhookSigningKey.publicSigningKey;
      expect(current).not.toBe(previous.body.data.myOrg.publicSigningKey);
      const reread = await session
        .post('/api/v1/graphql')
        .send({ query: '{ myOrg { publicSigningKey } }' });
      expect(reread.body).toEqual({
        data: { myOrg: { publicSigningKey: current } },
      });
      const after = await snapshot();
      expect(after.apiKeys).toEqual(before.apiKeys);
      expect(
        after.signingKeys.filter((key) => key.org_id === foreign.org.id),
      ).toEqual(
        before.signingKeys.filter((key) => key.org_id === foreign.org.id),
      );
      expect(
        after.signingKeys.find((key) => key.org_id === local.org.id)?.key_data,
      ).not.toEqual(
        before.signingKeys.find((key) => key.org_id === local.org.id)?.key_data,
      );
    },
  );
});
