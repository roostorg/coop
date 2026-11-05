import { faker } from '@faker-js/faker';
import { uid } from 'uid';

import { API_KEY_PERMISSIONS } from '../../services/apiKeyService/index.js';
import createOrg from '../../test/fixtureHelpers/createOrg.js';
import createUser from '../../test/fixtureHelpers/createUser.js';
import { makeTransactionalTestWithFixture } from '../../test/harness/transactionalTest.js';

describe('POST Items', () => {
  const testWithFixture = makeTransactionalTestWithFixture(async ({ deps }) => {
    const { ModerationConfigService, ApiKeyService, KyselyPg } = deps;
    const orgId = uid();
    const { apiKey } = await createOrg(
      { KyselyPg, ModerationConfigService, ApiKeyService },
      orgId,
    );

    const contentType = await ModerationConfigService.createContentType(orgId, {
      name: 'test',
      description: faker.string.sample(),
      schema: [
        {
          name: 'name',
          type: 'STRING',
          required: true,
          container: null,
        },
        {
          name: 'video',
          type: 'VIDEO',
          required: false,
          container: null,
        },
      ],
      schemaFieldRoles: {},
    });

    await createUser(KyselyPg, orgId, { id: uid() });

    return {
      orgId,
      apiKey,
      contentType,
      analytics: deps.DataWarehouseAnalytics,
    };
  });

  testWithFixture(
    'POST /items/async rejects valid keys without items:write',
    async ({ deps, request, orgId, contentType }) => {
      const payload = {
        items: [{ id: 'item', typeId: contentType.id, data: { name: 'Post' } }],
      };
      for (const permissions of [
        [],
        API_KEY_PERMISSIONS.filter(
          (permission) => permission.value !== 'items:write',
        ).map((permission) => permission.value),
      ]) {
        const { apiKey } = await deps.ApiKeyService.createApiKey(
          orgId,
          'Restricted',
          null,
          null,
          permissions,
        );
        await request
          .post('/api/v1/items/async')
          .set('x-api-key', apiKey)
          .send(payload)
          .expect(403);
      }
      const { apiKey } = await deps.ApiKeyService.createApiKey(
        orgId,
        'Allowed',
        null,
        null,
        ['items:write'],
      );
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send(payload)
        .expect(202);
    },
  );

  testWithFixture(
    'should return the expected response',
    async ({ request, apiKey, contentType, analytics }) => {
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: uid(),
              data: { name: 'John Doe' },
              typeId: contentType.id,
            },
          ],
        })
        .expect(202)
        .expect(({ body }) => {
          expect(body).toMatchInlineSnapshot(`{}`);
        });

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout ?? undefined).toEqual(undefined);
      });
    },
  );

  testWithFixture(
    'should return errors for only items that failed to be validated',
    async ({ request, apiKey, contentType, analytics }) => {
      const failingUid = uid();
      const failingUid2 = uid();
      await request
        .post('/api/v1/items/async')
        .set('x-api-key', apiKey)
        .send({
          items: [
            {
              id: uid(),
              data: { name: 'John Doe' },
              typeId: contentType.id,
            },
            {
              id: failingUid,
              data: { video: 'https://my-dummy-video.com/' },
              typeId: contentType.id,
            },
            {
              id: failingUid2,
              data: { video: 'https://second-dummy-video.com/' },
              typeId: contentType.id,
            },
          ],
        })
        .expect(400)
        .expect(({ body }) => {
          expect(body).toMatchInlineSnapshot(`
          {
            "errors": [
              {
                "detail": "The field 'name' is required, but was not provided.",
                "pointer": "/items/1",
                "status": 400,
                "title": "Invalid Data for Item",
                "type": [
                  "/errors/data-invalid-for-item-type",
                  "/errors/invalid-user-input",
                ],
              },
              {
                "detail": "The field 'name' is required, but was not provided.",
                "pointer": "/items/2",
                "status": 400,
                "title": "Invalid Data for Item",
                "type": [
                  "/errors/data-invalid-for-item-type",
                  "/errors/invalid-user-input",
                ],
              },
            ],
          }
        `);
        });

      analytics.bulkWrite.mock.calls.forEach(([, , config]) => {
        expect(config?.batchTimeout ?? undefined).toEqual(undefined);
      });
    },
  );
});
